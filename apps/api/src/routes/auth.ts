import express from "express";
import { z } from "zod";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  mintRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../services/authService";
import { prisma } from "../prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { sendError, sendSuccess } from "../utils/response";
import type { UserRole } from "@scan2serve/shared";

const router: express.Router = express.Router();

const isProd = process.env.NODE_ENV === "production";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;

const accessCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
  domain: COOKIE_DOMAIN,
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/api/auth/refresh",
  domain: COOKIE_DOMAIN,
};

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["customer", "business", "admin"] as [UserRole, ...UserRole[]]),
});

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(res, parse.error.message, 400, "VALIDATION_ERROR");
    }
    const { email, password, role } = parse.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return sendError(res, "Email already registered", 400, "EMAIL_EXISTS");
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, role },
    });
    return sendSuccess(res, {
      user: { id: user.id, email: user.email, role: user.role },
    }, 201);
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(res, parse.error.message, 400, "VALIDATION_ERROR");
    }
    const { email, password } = parse.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return sendError(res, "Invalid credentials", 401, "INVALID_CREDENTIALS");

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid)
      return sendError(res, "Invalid credentials", 401, "INVALID_CREDENTIALS");

    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await mintRefreshToken(user.id);

    res.cookie("access_token", accessToken, {
      ...accessCookieOptions,
      maxAge: 1000 * 60 * Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 15),
    });
    res.cookie("refresh_token", refreshToken.plain, {
      ...refreshCookieOptions,
      expires: refreshToken.record.expiresAt,
    });

    return sendSuccess(res, {
      user: { id: user.id, email: user.email, role: user.role },
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const incoming = req.cookies?.refresh_token as string | undefined;
    if (!incoming) return sendError(res, "Missing refresh token", 401, "NO_REFRESH_TOKEN");

    try {
      const rotated = await rotateRefreshToken(incoming);

      const user = await prisma.user.findUnique({ where: { id: rotated.record.userId } });
      if (!user) throw new Error("User not found");

      const accessToken = signAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      res.cookie("access_token", accessToken, {
        ...accessCookieOptions,
        maxAge: 1000 * 60 * Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 15),
      });
      res.cookie("refresh_token", rotated.plain, {
        ...refreshCookieOptions,
        expires: rotated.record.expiresAt,
      });

      return sendSuccess(res, {
        user: { id: user.id, email: user.email, role: user.role },
      });
    } catch (err) {
      return sendError(res, "Invalid or expired refresh token", 401, "INVALID_REFRESH");
    }
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const incoming = req.cookies?.refresh_token as string | undefined;
    await revokeRefreshToken(incoming);
    res.clearCookie("access_token", accessCookieOptions);
    res.clearCookie("refresh_token", refreshCookieOptions);
    return sendSuccess(res, { message: "Logged out" });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });
    if (!user) return sendError(res, "User not found", 404, "USER_NOT_FOUND");
    return sendSuccess(res, {
      user: { id: user.id, email: user.email, role: user.role },
    });
  })
);

export default router;
