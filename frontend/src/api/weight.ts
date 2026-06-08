import { WeightLog, WeightTrend } from "../types";
import api from "./client";

export const recordWeight = (date: string, weight: number) =>
  api.post<WeightLog>("/users/me/weight", { date, weight });

export const getWeightHistory = (from?: string, to?: string) =>
  api.get<WeightLog[]>("/users/me/weight", {
    params: {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
  });

export const getWeightTrend = (days = 30) =>
  api.get<WeightTrend>("/users/me/weight/trend", { params: { days } });
