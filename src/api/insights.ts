import axios from "axios";
import { api } from "./client";
import type { MonthSummaryInsight, TopCategoryInsight } from "./types";

/**
 * Server-generated insight text for a month.
 *
 * These live under `/ai/**`, which runs through the backend's bring-your-own-key interceptor: an
 * account without an AI key can be answered `402 Payment Required` by design, and the AI quota can
 * return `429`. **Neither is an error the user should see as a failure** — they mean "this
 * particular card has nothing to say right now", and the dashboard around it is perfectly fine.
 *
 * `null` is returned for those two cases so the card can render nothing at all rather than an
 * alarming message about a feature the user may not have asked for. Anything else still throws,
 * because a 500 is worth surfacing.
 */
const softFail = async <T>(request: Promise<T>): Promise<T | null> => {
  try {
    return await request;
  } catch (e) {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    if (status === 402 || status === 429) return null;
    throw e;
  }
};

export const monthSummary = (month: string) =>
  softFail(
    api
      .get<MonthSummaryInsight>("/ai/insights/month-summary", { params: { month } })
      .then((r) => r.data),
  );

export const topCategoryInsight = (month: string) =>
  softFail(
    api
      .get<TopCategoryInsight>("/ai/insights/top-category", { params: { month } })
      .then((r) => r.data),
  );
