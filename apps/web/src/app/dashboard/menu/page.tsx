"use client";

import React from "react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DIETARY_TAGS, type Category, type MenuItem } from "@scan2serve/shared";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch } from "../../../lib/api";

type MenuItemsResponse = {
  items: MenuItem[];
  total: number;
  page: number;
  limit: number;
};

type Suggestion = {
  label: string;
  confidence: number;
  dietaryTags?: string[];
};

type ItemEditDraft = {
  name: string;
  price: string;
  categoryId: string;
  dietaryTag: string;
  description: string;
};

export default function DashboardMenuPage() {
  const { user, loading, selectedBusiness } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [itemPage, setItemPage] = useState(1);
  const [itemLimit] = useState(10);
  const [itemTotal, setItemTotal] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("0.00");
  const [itemTags, setItemTags] = useState<string[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemEditDraft, setItemEditDraft] = useState<ItemEditDraft | null>(null);
  const [categorySuggestions, setCategorySuggestions] = useState<Suggestion[]>([]);
  const [itemSuggestions, setItemSuggestions] = useState<Suggestion[]>([]);
  const [itemSuggestionsLoading, setItemSuggestionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const suggestionRequestIdRef = useRef(0);

  const blocked =
    !selectedBusiness ||
    selectedBusiness.status === "pending" ||
    selectedBusiness.status === "rejected";

  const headers = useMemo(
    () =>
      selectedBusiness ? { "x-business-id": selectedBusiness.id } : undefined,
    [selectedBusiness]
  );

  const loadCategories = async () => {
    if (!headers) return [];
    const categoryData = await apiFetch<{ categories: Category[] }>("/api/business/categories", {
      method: "GET",
      headers,
    });
    setCategories(categoryData.categories);
    if (
      selectedCategoryId &&
      !categoryData.categories.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId("");
    }
    return categoryData.categories;
  };

  const loadCategorySuggestions = async () => {
    if (!headers) return;
    const data = await apiFetch<{ suggestions?: Suggestion[] }>(
      "/api/business/menu-suggestions/categories",
      {
        method: "GET",
        headers,
      }
    );
    setCategorySuggestions(data?.suggestions ?? []);
  };

  const loadItemSuggestions = async ({
    categoryId,
    query,
  }: {
    categoryId?: string;
    query?: string;
  } = {}) => {
    if (!headers || !selectedBusiness) return;
    const targetCategoryId = categoryId || selectedCategoryId || categories[0]?.id;
    if (!targetCategoryId) {
      setItemSuggestions([]);
      setItemSuggestionsLoading(false);
      return;
    }
    const requestId = suggestionRequestIdRef.current + 1;
    suggestionRequestIdRef.current = requestId;
    setItemSuggestionsLoading(true);
    setItemSuggestions([]);

    const q = query?.trim() || itemName.trim();
    const params = new URLSearchParams({
      businessId: selectedBusiness.id,
      categoryId: targetCategoryId,
      limit: "5",
    });
    if (q) params.set("q", q);

    const data = await apiFetch<{ suggestions?: Suggestion[] }>(
      `/api/ai/menu/item-suggestions?${params.toString()}`,
      {
        method: "GET",
        headers,
      }
    );
    if (suggestionRequestIdRef.current !== requestId) return;
    setItemSuggestions(data?.suggestions ?? []);
    setItemSuggestionsLoading(false);
  };

  const loadItems = async (page: number) => {
    if (!headers) return;
    const itemData = await apiFetch<MenuItemsResponse>(
      `/api/business/menu-items?page=${page}&limit=${itemLimit}`,
      {
        method: "GET",
        headers,
      }
    );
    setItems(itemData.items);
    setItemPage(itemData.page);
    setItemTotal(itemData.total);
  };

  useEffect(() => {
    if (!loading && !user) router.push("/home");
  }, [loading, user, router]);

  useEffect(() => {
    if (!blocked) {
      Promise.all([loadCategories(), loadItems(1), loadCategorySuggestions()]).catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load menu")
      );
    }
  }, [blocked, headers, itemLimit]);

  useEffect(() => {
    if (blocked) return;
    const delayMs = itemName.trim() ? 280 : 0;
    const timer = setTimeout(() => {
      loadItemSuggestions({
        categoryId: selectedCategoryId || categories[0]?.id,
        query: itemName,
      }).catch((err) => {
        setItemSuggestionsLoading(false);
        setError(err instanceof Error ? err.message : "Failed to load item suggestions");
      });
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [blocked, headers, selectedBusiness, selectedCategoryId, categories, itemTotal, itemName]);

  if (loading) return <main className="min-h-screen p-8">Loading...</main>;
  if (!user) return null;

  if (user.role !== "business") {
    return <main className="min-h-screen p-8">Only business users can manage menu.</main>;
  }

  const totalPages = Math.max(1, Math.ceil(itemTotal / itemLimit));
  const filteredItems = items.filter((item) =>
    selectedCategoryId ? item.categoryId === selectedCategoryId : true
  );

  const createCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!headers || !categoryName.trim()) return;
    if (categoryName.trim().length < 2) {
      setError("Category name must be at least 2 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/business/categories", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: categoryName.trim() }),
      });
      setCategoryName("");
      await Promise.all([loadCategories(), loadCategorySuggestions()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setBusy(false);
    }
  };

  const createItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!headers || !itemName.trim()) return;
    const targetCategoryId = selectedCategoryId || categories[0]?.id;
    if (!targetCategoryId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/business/menu-items", {
        method: "POST",
        headers,
        body: JSON.stringify({
          categoryId: targetCategoryId,
          name: itemName.trim(),
          price: itemPrice,
          dietaryTags: itemTags,
        }),
      });
      setItemName("");
      setItemPrice("0.00");
      setItemTags([]);
      await loadItems(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create menu item");
    } finally {
      setBusy(false);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    if (!headers) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/business/menu-items/${item.id}/availability`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      await loadItems(itemPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update availability");
    } finally {
      setBusy(false);
    }
  };

  const reorderItem = async (item: MenuItem, direction: -1 | 1) => {
    if (!headers) return;
    const group = filteredItems;
    const index = group.findIndex((entry) => entry.id === item.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= group.length) return;

    const next = [...group];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    const orders = next.map((entry, idx) => ({ id: entry.id, sortOrder: idx }));
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/business/menu-items/reorder", {
        method: "POST",
        headers,
        body: JSON.stringify({ orders }),
      });
      await loadItems(itemPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder items");
    } finally {
      setBusy(false);
    }
  };

  const reorderCategory = async (category: Category, direction: -1 | 1) => {
    if (!headers) return;
    const index = categories.findIndex((entry) => entry.id === category.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;

    const next = [...categories];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    const orders = next.map((entry, idx) => ({ id: entry.id, sortOrder: idx }));
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/business/categories/reorder", {
        method: "POST",
        headers,
        body: JSON.stringify({ orders }),
      });
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder categories");
    } finally {
      setBusy(false);
    }
  };

  const startCategoryEdit = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const saveCategoryEdit = async () => {
    if (!headers || !editingCategoryId || !editingCategoryName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/business/categories/${editingCategoryId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: editingCategoryName.trim() }),
      });
      setEditingCategoryId(null);
      setEditingCategoryName("");
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setBusy(false);
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!headers) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/business/categories/${categoryId}`, {
        method: "DELETE",
        headers,
      });
      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId("");
      }
      await Promise.all([loadCategories(), loadCategorySuggestions()]);
      await loadItems(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setBusy(false);
    }
  };

  const startItemEdit = (item: MenuItem) => {
    setEditingItemId(item.id);
    setItemEditDraft({
      name: item.name,
      price: item.price,
      categoryId: item.categoryId,
      dietaryTag: item.dietaryTags[0] || "",
      description: item.description || "",
    });
  };

  const saveItemEdit = async () => {
    if (!headers || !editingItemId || !itemEditDraft) return;
    if (!itemEditDraft.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/business/menu-items/${editingItemId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: itemEditDraft.name.trim(),
          price: itemEditDraft.price,
          categoryId: itemEditDraft.categoryId,
          dietaryTags: itemEditDraft.dietaryTag ? [itemEditDraft.dietaryTag] : [],
          description: itemEditDraft.description.trim() || null,
        }),
      });
      setEditingItemId(null);
      setItemEditDraft(null);
      await loadItems(itemPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update menu item");
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!headers) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/business/menu-items/${itemId}`, {
        method: "DELETE",
        headers,
      });
      const nextPage = items.length === 1 && itemPage > 1 ? itemPage - 1 : itemPage;
      await loadItems(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete menu item");
    } finally {
      setBusy(false);
    }
  };

  const goToPage = async (nextPage: number) => {
    if (!headers || nextPage < 1 || nextPage > totalPages || nextPage === itemPage) return;
    setBusy(true);
    setError(null);
    try {
      await loadItems(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load menu page");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold">Categories</h2>
          <form onSubmit={createCategory} className="mt-3 flex gap-2">
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="New category"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy || blocked}
              className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Add
            </button>
          </form>
          {!!categorySuggestions.length && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-600">Suggested categories</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {categorySuggestions.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    onClick={() => setCategoryName(suggestion.label)}
                    disabled={busy || blocked}
                    className="rounded-full border border-gray-300 px-2 py-1 text-xs"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => setSelectedCategoryId("")}
            disabled={busy}
            className={`mt-3 w-full rounded-md border px-3 py-2 text-left text-sm ${
              selectedCategoryId === "" ? "border-black bg-gray-100" : "border-gray-200"
            }`}
          >
            All categories
          </button>
          <div className="mt-4 space-y-2">
            {categories.map((category, idx) => (
              <div key={category.id} className="rounded-md border border-gray-200 p-2">
                {editingCategoryId === category.id ? (
                  <div className="space-y-2">
                    <input
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveCategoryEdit}
                        disabled={busy}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingCategoryId(null);
                          setEditingCategoryName("");
                        }}
                        disabled={busy}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        selectedCategoryId === category.id
                          ? "border-black bg-gray-100"
                          : "border-gray-200"
                      }`}
                    >
                      {category.name}
                    </button>
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => reorderCategory(category, -1)}
                        disabled={busy || blocked || idx === 0}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Up
                      </button>
                      <button
                        onClick={() => reorderCategory(category, 1)}
                        disabled={busy || blocked || idx === categories.length - 1}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Down
                      </button>
                      <button
                        onClick={() => startCategoryEdit(category)}
                        disabled={busy || blocked}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => deleteCategory(category.id)}
                        disabled={busy || blocked}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold">Menu Items</h2>
          {blocked && (
            <p className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-800">
              Menu changes are disabled until your selected business is approved.
            </p>
          )}
          <form onSubmit={createItem} className="mt-3 grid gap-2 md:grid-cols-4">
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Item name"
              className="rounded-md border px-3 py-2 text-sm"
            />
            <input
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              placeholder="Price (e.g. 12.50)"
              className="rounded-md border px-3 py-2 text-sm"
            />
            <select
              value={itemTags[0] || ""}
              onChange={(e) => setItemTags(e.target.value ? [e.target.value] : [])}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="">No dietary tag</option>
              {DIETARY_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy || blocked || categories.length === 0}
              className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Add item
            </button>
          </form>
          {!itemSuggestionsLoading && !!itemSuggestions.length && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-600">Suggested menu items</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {itemSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    onClick={() => {
                      setItemName(suggestion.label);
                      setItemTags(suggestion.dietaryTags?.slice(0, 1) ?? []);
                    }}
                    disabled={busy || blocked}
                    className="rounded-full border border-gray-300 px-2 py-1 text-xs"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-4 space-y-2">
            {filteredItems.map((item, idx) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                {editingItemId === item.id && itemEditDraft ? (
                  <div className="grid w-full gap-2 md:grid-cols-5">
                    <input
                      value={itemEditDraft.name}
                      onChange={(e) =>
                        setItemEditDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                      }
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <input
                      value={itemEditDraft.price}
                      onChange={(e) =>
                        setItemEditDraft((prev) => (prev ? { ...prev, price: e.target.value } : prev))
                      }
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <select
                      value={itemEditDraft.categoryId}
                      onChange={(e) =>
                        setItemEditDraft((prev) =>
                          prev ? { ...prev, categoryId: e.target.value } : prev
                        )
                      }
                      className="rounded border px-2 py-1 text-sm"
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={itemEditDraft.dietaryTag}
                      onChange={(e) =>
                        setItemEditDraft((prev) =>
                          prev ? { ...prev, dietaryTag: e.target.value } : prev
                        )
                      }
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="">No dietary tag</option>
                      {DIETARY_TAGS.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <button
                        onClick={saveItemEdit}
                        disabled={busy || blocked}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingItemId(null);
                          setItemEditDraft(null);
                        }}
                        disabled={busy || blocked}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        ${Number.parseFloat(item.price).toFixed(2)}
                      </p>
                      {!!item.dietaryTags.length && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.dietaryTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => reorderItem(item, -1)}
                        disabled={busy || blocked || idx === 0}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Up
                      </button>
                      <button
                        onClick={() => reorderItem(item, 1)}
                        disabled={busy || blocked || idx === filteredItems.length - 1}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Down
                      </button>
                      <button
                        onClick={() => startItemEdit(item)}
                        disabled={busy || blocked}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        disabled={busy || blocked}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => toggleAvailability(item)}
                        disabled={busy || blocked}
                        className={`rounded px-2 py-1 text-xs text-white ${
                          item.isAvailable ? "bg-green-600" : "bg-gray-500"
                        }`}
                      >
                        {item.isAvailable ? "Available" : "Unavailable"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {!filteredItems.length && (
              <p className="text-sm text-gray-600">No items in selected category.</p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <p className="text-xs text-gray-600">
              Page {itemPage} of {totalPages} ({itemTotal} total items)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => goToPage(itemPage - 1)}
                disabled={busy || itemPage <= 1}
                className="rounded border px-3 py-1 text-xs disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => goToPage(itemPage + 1)}
                disabled={busy || itemPage >= totalPages}
                className="rounded border px-3 py-1 text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
