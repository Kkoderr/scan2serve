import express from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { sendError, sendSuccess } from "../utils/response";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireApprovedBusiness } from "../middleware/businessApproval";
import { getMenuItemSuggestions } from "../services/llmMenuSuggestions";

const router: express.Router = express.Router();

const itemSuggestionsQuerySchema = z.object({
  businessId: z.string().min(1),
  categoryId: z.string().min(1),
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

router.use(requireAuth, requireRole("business"));

router.get(
  "/menu/item-suggestions",
  requireApprovedBusiness,
  asyncHandler(async (req, res) => {
    const parsed = itemSuggestionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, parsed.error.message, 400, "VALIDATION_ERROR");
      return;
    }

    if (req.business!.id !== parsed.data.businessId) {
      sendError(res, "Business mismatch in request", 403, "BUSINESS_SCOPE_MISMATCH");
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

export default router;
