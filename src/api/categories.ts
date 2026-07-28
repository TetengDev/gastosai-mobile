import { api } from "./client";
import type { CategoryRequest, CategoryResponse } from "./types";

/**
 * Categories are shared by the capture flow's chips, budgets and recurring bills, so renaming one
 * here changes what those screens offer. `bucket` (NEEDS / WANTS / SAVINGS) is assigned on web as
 * part of the 50/30/20 rules and is rendered read-only on mobile.
 */
export const listCategories = () =>
  api.get<CategoryResponse[]>("/categories").then((r) => r.data);

export const renameCategory = (id: number, body: CategoryRequest) =>
  api.put<CategoryResponse>(`/categories/${id}`, body).then((r) => r.data);

export const deleteCategory = (id: number) => api.delete(`/categories/${id}`).then(() => undefined);
