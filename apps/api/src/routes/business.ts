import express from "express";
import crypto from "crypto";
import { z } from "zod";
import { DIETARY_TAGS } from "@scan2serve/shared";
import { prisma } from "../prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { sendError, sendSuccess } from "../utils/response";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireApprovedBusiness, resolveBusinessForUser } from "../middleware/businessApproval";
import { suggestCategories } from "../services/menuSuggestions";
import { getMenuItemSuggestions } from "../services/llmMenuSuggestions";

const router: express.Router = express.Router();

const profileCreateSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional().nullable(),
  logoUrl: z.string().url().max(500).optional().nullable(),
  address: z.string().min(5),
  phone: z.string().min(6).max(32),
});

const profileUpdateSchema = z.object({
  businessId: z.string().optional(),
  name: z.string().min(2).optional(),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(2000).optional().nullable(),
  logoUrl: z.string().url().max(500).optional().nullable(),
  address: z.string().min(5).optional(),
  phone: z.string().min(6).max(32).optional(),
});

const qrRotateSchema = z.object({
  reason: z.string().max(250).optional(),
});

const qrRotationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
const categoryCreateSchema = z.object({
  name: z.string().min(2).max(80),
});
const categoryUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
const categoryReorderSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number().int().min(0),
    })
  ).min(1),
});
const menuItemCreateSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a decimal string"),
  imageUrl: z.string().url().max(500).optional().nullable(),
  dietaryTags: z.array(z.enum(DIETARY_TAGS)).optional(),
  isAvailable: z.boolean().optional(),
});
const menuItemUpdateSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a decimal string").optional(),
  imageUrl: z.string().url().max(500).optional().nullable(),
  dietaryTags: z.array(z.enum(DIETARY_TAGS)).optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
const menuItemReorderSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number().int().min(0),
    })
  ).min(1),
});
const menuItemAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});
const menuItemListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const menuItemSuggestionQuerySchema = z.object({
  categoryId: z.string().min(1),
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

type RawBusiness = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  address: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
  rejections?: { id: string; reason: string | null; createdAt: Date }[];
};

type SerializedBusiness = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  address: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
  rejections?: { id: string; reason: string | null; createdAt: string }[];
};

const serializeBusiness = (business: RawBusiness): SerializedBusiness => {
  const serialized: SerializedBusiness = {
    id: business.id,
    userId: business.userId,
    name: business.name,
    slug: business.slug,
    description: business.description,
    logoUrl: business.logoUrl,
    address: business.address,
    phone: business.phone,
    status: business.status,
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  };

  if (business.rejections) {
    serialized.rejections = business.rejections.map((item) => ({
      id: item.id,
      reason: item.reason,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  return serialized;
};

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (error as any).code === "P2002";

const generateQrToken = () => crypto.randomBytes(16).toString("hex");
const qrOldTokenGraceSec = Math.max(
  0,
  Number(process.env.QR_OLD_TOKEN_GRACE_SEC || 0)
);

router.use(requireAuth, requireRole("business"));

router.post(
  "/profile",
  asyncHandler(async (req, res) => {
    const parsed = profileCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }

    try {
      const created = await prisma.business.create({
        data: {
          userId: req.user!.id,
          name: parsed.data.name,
          slug: parsed.data.slug,
          description: parsed.data.description ?? null,
          logoUrl: parsed.data.logoUrl ?? null,
          address: parsed.data.address,
          phone: parsed.data.phone,
          status: "pending",
        },
      });

      sendSuccess(res, { business: serializeBusiness(created as RawBusiness) }, 201);
      return;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        sendError(res, "Business profile already exists", 409, "BUSINESS_PROFILE_EXISTS");
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/profiles",
  asyncHandler(async (req, res) => {
    const businesses = await prisma.business.findMany({
      where: { userId: req.user!.id },
      include: {
        rejections: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    sendSuccess(res, {
      businesses: businesses.map((business: RawBusiness) => serializeBusiness(business)),
    });
  })
);

router.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const business = await resolveBusinessForUser(req);
    if (!business) {
      sendError(res, "Business profile not found", 404, "BUSINESS_PROFILE_REQUIRED");
      return;
    }

    const withRejections = await prisma.business.findUnique({
      where: { id: business.id },
      include: {
        rejections: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    });

    sendSuccess(res, {
      business: serializeBusiness((withRejections ?? business) as RawBusiness),
    });
  })
);

router.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }

    const business = parsed.data.businessId
      ? await prisma.business.findFirst({
          where: { id: parsed.data.businessId, userId: req.user!.id },
        })
      : await resolveBusinessForUser(req);

    if (!business) {
      sendError(res, "Business profile not found", 404, "BUSINESS_PROFILE_REQUIRED");
      return;
    }

    const data = {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.logoUrl !== undefined ? { logoUrl: parsed.data.logoUrl } : {}),
      ...(parsed.data.address !== undefined ? { address: parsed.data.address } : {}),
      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
      ...(business.status === "rejected" ? { status: "pending" as const } : {}),
    };

    if (Object.keys(data).length === 0) {
      sendError(res, "No fields provided for update", 400, "VALIDATION_ERROR");
      return;
    }

    try {
      const updated = await prisma.business.update({
        where: { id: business.id },
        data,
        include: {
          rejections: {
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
      });

      sendSuccess(res, { business: serializeBusiness(updated as RawBusiness) });
      return;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        sendError(res, "Business profile already exists", 409, "BUSINESS_PROFILE_EXISTS");
        return;
      }
      throw error;
    }
  })
);

router.get(
  "/categories",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { businessId: req.business!.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    sendSuccess(res, { categories });
  })
);

router.get(
  "/menu-suggestions/categories",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { businessId: req.business!.id },
      select: { name: true },
    });
    const suggestions = suggestCategories(
      categories.map((category: { name: string }) => category.name)
    );
    sendSuccess(res, { suggestions });
  })
);

router.get(
  "/menu-suggestions/items",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const parsed = menuItemSuggestionQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }

    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, businessId: req.business!.id },
      select: { id: true, name: true },
    });
    if (!category) {
      sendError(res, "Category not found", 404, "CATEGORY_NOT_FOUND");
      return;
    }

    const existingItems = await prisma.menuItem.findMany({
      where: { businessId: req.business!.id, categoryId: category.id },
      select: { name: true },
    });

    const suggestions = await getMenuItemSuggestions({
      categoryName: category.name,
      existingItemNames: existingItems.map((item: { name: string }) => item.name),
      typedQuery: parsed.data.q,
      limit: parsed.data.limit ?? 5,
    });
    sendSuccess(res, { suggestions });
  })
);

router.post(
  "/categories",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const parsed = categoryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }
    const max = await prisma.category.aggregate({
      where: { businessId: req.business!.id },
      _max: { sortOrder: true },
    });
    try {
      const category = await prisma.category.create({
        data: {
          businessId: req.business!.id,
          name: parsed.data.name,
          sortOrder: (max._max.sortOrder ?? -1) + 1,
        },
      });
      sendSuccess(res, { category }, 201);
      return;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        sendError(res, "Category name already exists", 409, "CATEGORY_EXISTS");
        return;
      }
      throw error;
    }
  })
);

router.patch(
  "/categories/:id",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const parsed = categoryUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }
    const id = req.params.id;
    const existing = await prisma.category.findFirst({
      where: { id, businessId: req.business!.id },
    });
    if (!existing) {
      sendError(res, "Category not found", 404, "CATEGORY_NOT_FOUND");
      return;
    }
    try {
      const category = await prisma.category.update({
        where: { id: existing.id },
        data: parsed.data,
      });
      sendSuccess(res, { category });
      return;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        sendError(res, "Category name already exists", 409, "CATEGORY_EXISTS");
        return;
      }
      throw error;
    }
  })
);

router.post(
  "/categories/reorder",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const parsed = categoryReorderSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }
    await prisma.$transaction(
      parsed.data.orders.map((item) =>
        prisma.category.updateMany({
          where: { id: item.id, businessId: req.business!.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    sendSuccess(res, { updated: parsed.data.orders.length });
  })
);

router.delete(
  "/categories/:id",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.category.findFirst({
      where: { id, businessId: req.business!.id },
    });
    if (!existing) {
      sendError(res, "Category not found", 404, "CATEGORY_NOT_FOUND");
      return;
    }

    const linkedItems = await prisma.menuItem.count({
      where: { categoryId: existing.id, businessId: req.business!.id },
    });
    if (linkedItems > 0) {
      sendError(
        res,
        "Cannot delete non-empty category",
        409,
        "CATEGORY_NOT_EMPTY"
      );
      return;
    }

    await prisma.category.delete({ where: { id: existing.id } });
    sendSuccess(res, { deleted: true });
  })
);

router.get(
  "/menu-items",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const parsed = menuItemListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }
    const { page, limit } = parsed.data;
    const skip = (page - 1) * limit;
    const [total, items] = await prisma.$transaction([
      prisma.menuItem.count({ where: { businessId: req.business!.id } }),
      prisma.menuItem.findMany({
        where: { businessId: req.business!.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip,
        take: limit,
      }),
    ]);

    sendSuccess(res, { items, page, limit, total });
  })
);

router.post(
  "/menu-items",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const parsed = menuItemCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, businessId: req.business!.id },
    });
    if (!category) {
      sendError(res, "Category not found", 404, "CATEGORY_NOT_FOUND");
      return;
    }
    const max = await prisma.menuItem.aggregate({
      where: { businessId: req.business!.id },
      _max: { sortOrder: true },
    });
    const item = await prisma.menuItem.create({
      data: {
        businessId: req.business!.id,
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        price: parsed.data.price,
        imageUrl: parsed.data.imageUrl ?? null,
        dietaryTags: parsed.data.dietaryTags ?? [],
        isAvailable: parsed.data.isAvailable ?? true,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    sendSuccess(res, { item }, 201);
  })
);

router.patch(
  "/menu-items/:id",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const parsed = menuItemUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }
    const id = req.params.id;
    const existing = await prisma.menuItem.findFirst({
      where: { id, businessId: req.business!.id },
    });
    if (!existing) {
      sendError(res, "Menu item not found", 404, "MENU_ITEM_NOT_FOUND");
      return;
    }
    if (parsed.data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: parsed.data.categoryId, businessId: req.business!.id },
      });
      if (!category) {
        sendError(res, "Category not found", 404, "CATEGORY_NOT_FOUND");
        return;
      }
    }
    const item = await prisma.menuItem.update({
      where: { id: existing.id },
      data: parsed.data,
    });
    sendSuccess(res, { item });
  })
);

router.post(
  "/menu-items/reorder",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const parsed = menuItemReorderSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }
    await prisma.$transaction(
      parsed.data.orders.map((item) =>
        prisma.menuItem.updateMany({
          where: { id: item.id, businessId: req.business!.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    sendSuccess(res, { updated: parsed.data.orders.length });
  })
);

router.patch(
  "/menu-items/:id/availability",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const parsed = menuItemAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }
    const id = req.params.id;
    const existing = await prisma.menuItem.findFirst({
      where: { id, businessId: req.business!.id },
    });
    if (!existing) {
      sendError(res, "Menu item not found", 404, "MENU_ITEM_NOT_FOUND");
      return;
    }
    const item = await prisma.menuItem.update({
      where: { id: existing.id },
      data: { isAvailable: parsed.data.isAvailable },
    });
    sendSuccess(res, { item });
  })
);

router.delete(
  "/menu-items/:id",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.menuItem.findFirst({
      where: { id, businessId: req.business!.id },
    });
    if (!existing) {
      sendError(res, "Menu item not found", 404, "MENU_ITEM_NOT_FOUND");
      return;
    }
    await prisma.menuItem.delete({ where: { id: existing.id } });
    sendSuccess(res, { deleted: true });
  })
);

// Layer 4+ entry points (guarded now to enforce onboarding policy early).
router.get(
  "/menu",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    sendSuccess(res, { items: [], businessId: req.business!.id });
  })
);

router.get(
  "/tables",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    sendSuccess(res, { tables: [], businessId: req.business!.id });
  })
);

router.post(
  "/tables/:tableId/qr/regenerate",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const parsed = qrRotateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }

    const tableId = req.params.tableId;
    if (!tableId) {
      sendError(res, "Table id is required", 400, "VALIDATION_ERROR");
      return;
    }

    const table = await prisma.table.findFirst({
      where: { id: tableId, businessId: req.business!.id },
    });

    if (!table) {
      sendError(res, "Table not found for business", 404, "TABLE_NOT_FOUND");
      return;
    }

    const existingQr = await prisma.qrCode.findUnique({
      where: { tableId: table.id },
    });

    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const nextToken = generateQrToken();
      try {
        const qrCode = existingQr
          ? await prisma.qrCode.update({
              where: { id: existingQr.id },
              data: { uniqueCode: nextToken, qrImageUrl: null },
            })
          : await prisma.qrCode.create({
              data: {
                businessId: req.business!.id,
                tableId: table.id,
                uniqueCode: nextToken,
                qrImageUrl: null,
              },
            });

        if (existingQr && existingQr.uniqueCode !== nextToken) {
          const graceExpiresAt =
            qrOldTokenGraceSec > 0
              ? new Date(Date.now() + qrOldTokenGraceSec * 1000)
              : null;
          await prisma.qrCodeRotation.create({
            data: {
              qrCodeId: qrCode.id,
              oldToken: existingQr.uniqueCode,
              newToken: nextToken,
              rotatedByUserId: req.user!.id,
              reason: parsed.data.reason ?? null,
              graceExpiresAt,
            },
          });
        }

        sendSuccess(res, {
          qrCode: {
            id: qrCode.id,
            tableId: qrCode.tableId,
            businessId: qrCode.businessId,
            uniqueCode: qrCode.uniqueCode,
            createdAt: qrCode.createdAt.toISOString(),
          },
          graceExpiresAt:
            qrOldTokenGraceSec > 0
              ? new Date(Date.now() + qrOldTokenGraceSec * 1000).toISOString()
              : null,
        });
        return;
      } catch (error) {
        if (isUniqueConstraintError(error)) continue;
        throw error;
      }
    }

    sendError(res, "Failed to rotate QR token", 500, "QR_ROTATION_FAILED");
  })
);

router.get(
  "/tables/:tableId/qr/rotations",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const parsedQuery = qrRotationListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      sendError(res, parsedQuery.error.message, 400, "VALIDATION_ERROR");
      return;
    }
    const limit = parsedQuery.data.limit ?? 20;
    const tableId = req.params.tableId;
    if (!tableId) {
      sendError(res, "Table id is required", 400, "VALIDATION_ERROR");
      return;
    }

    const qrCode = await prisma.qrCode.findFirst({
      where: {
        tableId,
        businessId: req.business!.id,
      },
    });

    if (!qrCode) {
      sendError(res, "QR code not found for table", 404, "QR_CODE_NOT_FOUND");
      return;
    }

    const rows = await prisma.qrCodeRotation.findMany({
      where: { qrCodeId: qrCode.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    sendSuccess(res, {
      rotations: rows.map((row: any) => ({
        id: row.id,
        oldToken: row.oldToken,
        newToken: row.newToken,
        rotatedByUserId: row.rotatedByUserId,
        reason: row.reason,
        graceExpiresAt: row.graceExpiresAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  })
);

router.get(
  "/orders",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    sendSuccess(res, { orders: [], businessId: req.business!.id });
  })
);

// Legacy probe used by tests.
router.get(
  "/ops/ping",
  requireApprovedBusiness,
  asyncHandler(async (_req, res) => {
    sendSuccess(res, { ok: true });
  })
);

export default router;
