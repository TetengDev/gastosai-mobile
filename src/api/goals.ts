import { api } from "./client";
import type { GoalRequest, GoalResponse } from "./types";

/** Savings goals. `progressPercent` and `status` are server-computed — render, never recompute. */
export const listGoals = () => api.get<GoalResponse[]>("/goals").then((r) => r.data);

export const createGoal = (body: GoalRequest) =>
  api.post<GoalResponse>("/goals", body).then((r) => r.data);

export const updateGoal = (id: number, body: GoalRequest) =>
  api.put<GoalResponse>(`/goals/${id}`, body).then((r) => r.data);

export const deleteGoal = (id: number) => api.delete(`/goals/${id}`).then(() => undefined);
