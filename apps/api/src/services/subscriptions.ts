import type { Prisma } from "@prisma/client";
import { SUBSCRIPTION_PLANS, type PaidSubscriptionPlan, type SubscriptionPlan, type SubscriptionStatus } from "@scan2serve/shared";
import { prisma } from "../prisma";
import { logger } from "../utils/logger";
import { getRedisClient } from "./redisClient";

const cachePrefix = process.env.SUBSCRIPTION_CACHE_PREFIX || "org-subscription";
const cacheTtlSec = Math.max(30, Number(process.env.SUBSCRIPTION_CACHE_TTL_SEC || 300));

const planLookup = new Map(SUBSCRIPTION_PLANS.map((plan) => [plan.id, plan]));

const buildCacheKey = (orgId: string) => `${cachePrefix}:${orgId}`;

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < day) {
    next.setDate(0);
  }
  return next;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const calculateDaysRemaining = (endDate: Date) => {
  const diffMs = endDate.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

const getCachedStatus = async (orgId: string): Promise<SubscriptionStatus | null> => {
  try {
    const client = await getRedisClient();
    const value = await client.get(buildCacheKey(orgId));
    if (!value) return null;
    return JSON.parse(value) as SubscriptionStatus;
  } catch (error) {
    logger.warn("subscription.cache.get_failed", {
      orgId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const setCachedStatus = async (orgId: string, status: SubscriptionStatus) => {
  try {
    const client = await getRedisClient();
    await client.set(buildCacheKey(orgId), JSON.stringify(status), { EX: cacheTtlSec });
  } catch (error) {
    logger.warn("subscription.cache.set_failed", {
      orgId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
};

const notifySubscriptionExpired = async (params: {
  orgId: string;
  latest: { id: string; periodEnd: Date };
}) => {
  const [org, businessOwners, membershipManagers] = await Promise.all([
    prisma.org.findUnique({
      where: { id: params.orgId },
      select: { ownerUserId: true },
    }),
    prisma.business.findMany({
      where: { orgId: params.orgId },
      select: { userId: true, id: true },
    }),
    prisma.businessMembership.findMany({
      where: {
        role: { in: ["owner", "manager"] },
        business: { orgId: params.orgId },
      },
      select: { userId: true },
    }),
  ]);

  const targetUserIds = new Set<string>();
  if (org?.ownerUserId) targetUserIds.add(org.ownerUserId);
  businessOwners.forEach((business) => targetUserIds.add(business.userId));
  membershipManagers.forEach((member) => targetUserIds.add(member.userId));

  if (targetUserIds.size === 0) return;

  const message = "Your org subscription has expired. Renew to restore dashboard access.";
  await Promise.all(
    Array.from(targetUserIds).map(async (userId) => {
      const event = await prisma.notificationEvent.create({
        data: {
          userId,
          actorUserId: null,
          businessId: null,
          type: "SUBSCRIPTION_EXPIRED",
          message,
          payload: { orgId: params.orgId, expiredAt: params.latest.periodEnd.toISOString() } as Prisma.JsonValue,
        },
      });
      await prisma.notificationInbox.create({
        data: { userId, eventId: event.id },
      });
    })
  );
};

export const getSubscriptionPlan = (planId: PaidSubscriptionPlan) => {
  const plan = planLookup.get(planId);
  if (!plan) return null;
  return plan;
};

export const getOrgSubscriptionStatus = async (orgId: string): Promise<SubscriptionStatus> => {
  const cached = await getCachedStatus(orgId);
  if (cached) return cached;

  const latest = await prisma.orgSubscription.findFirst({
    where: { orgId },
    orderBy: { periodEnd: "desc" },
  });

  if (!latest) {
    const status: SubscriptionStatus = {
      isActive: false,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      plan: null,
      currency: "INR",
      amount: null,
      daysRemaining: null,
    };
    await setCachedStatus(orgId, status);
    return status;
  }

  const now = new Date();
  const isActive = latest.periodEnd.getTime() >= now.getTime();

  if (!isActive && !latest.expiryNotifiedAt) {
    try {
      await notifySubscriptionExpired({ orgId, latest });
      await prisma.orgSubscription.update({
        where: { id: latest.id },
        data: { expiryNotifiedAt: now },
      });
    } catch (error) {
      logger.warn("subscription.expiry.notify_failed", {
        orgId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const status: SubscriptionStatus = {
    isActive,
    currentPeriodStart: latest.periodStart.toISOString(),
    currentPeriodEnd: latest.periodEnd.toISOString(),
    plan: latest.plan as SubscriptionPlan,
    currency: latest.currency,
    amount: latest.amount,
    daysRemaining: isActive ? calculateDaysRemaining(latest.periodEnd) : 0,
  };

  await setCachedStatus(orgId, status);
  return status;
};

export const createOrgTrialSubscription = async (params: {
  orgId: string;
  createdByUserId: string;
}) => {
  const start = new Date();
  const end = addMonths(start, 1);

  const subscription = await prisma.orgSubscription.create({
    data: {
      orgId: params.orgId,
      plan: "trial",
      amount: 0,
      currency: "INR",
      periodStart: start,
      periodEnd: end,
      createdByUserId: params.createdByUserId,
    },
  });

  const status: SubscriptionStatus = {
    isActive: true,
    currentPeriodStart: subscription.periodStart.toISOString(),
    currentPeriodEnd: subscription.periodEnd.toISOString(),
    plan: subscription.plan as SubscriptionPlan,
    currency: subscription.currency,
    amount: subscription.amount,
    daysRemaining: calculateDaysRemaining(subscription.periodEnd),
  };
  await setCachedStatus(params.orgId, status);
  return subscription;
};

export const createPaidSubscription = async (params: {
  orgId: string;
  plan: PaidSubscriptionPlan;
  createdByUserId: string;
  paymentRecordId: string;
  prismaClient?: Prisma.TransactionClient;
}) => {
  const plan = getSubscriptionPlan(params.plan);
  if (!plan) {
    throw new Error("Invalid subscription plan");
  }

  const client = params.prismaClient ?? prisma;

  const latest = await client.orgSubscription.findFirst({
    where: { orgId: params.orgId },
    orderBy: { periodEnd: "desc" },
  });

  const now = new Date();
  const baseStart = latest && latest.periodEnd.getTime() >= now.getTime()
    ? addDays(latest.periodEnd, 1)
    : now;
  const periodEnd = addMonths(baseStart, plan.months);

  const subscription = await client.orgSubscription.create({
    data: {
      orgId: params.orgId,
      plan: plan.id,
      amount: plan.amount,
      currency: plan.currency,
      periodStart: baseStart,
      periodEnd,
      createdByUserId: params.createdByUserId,
      paymentRecordId: params.paymentRecordId,
    },
  });

  const status: SubscriptionStatus = {
    isActive: true,
    currentPeriodStart: subscription.periodStart.toISOString(),
    currentPeriodEnd: subscription.periodEnd.toISOString(),
    plan: subscription.plan as SubscriptionPlan,
    currency: subscription.currency,
    amount: subscription.amount,
    daysRemaining: calculateDaysRemaining(subscription.periodEnd),
  };

  await setCachedStatus(params.orgId, status);
  return subscription;
};

export const clearOrgSubscriptionCache = async (orgId: string) => {
  try {
    const client = await getRedisClient();
    await client.del(buildCacheKey(orgId));
  } catch (error) {
    logger.warn("subscription.cache.clear_failed", {
      orgId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
};
