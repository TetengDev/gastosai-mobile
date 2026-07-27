import { api } from "./client";
import type { GoalResponse } from "./types";

/** Savings goals. `progressPercent` and `status` are server-computed — render, never recompute. */
export const listGoals = () => api.get<GoalResponse[]>("/goals").then((r) => r.data);
