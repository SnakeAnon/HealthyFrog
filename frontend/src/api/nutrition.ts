import {
  DailyReport,
  Meal,
  MealAnalysis,
  MealItem,
  PeriodReport,
  Product,
  RangeReport,
  SummaryReport,
  VoiceAnalysis,
  WeeklyReport,
} from "../types";
import api from "./client";

export const getProducts = (search?: string) =>
  api.get<Product[]>("/nutrition/products", { params: search ? { search } : {} });

export const createProduct = (data: Omit<Product, "id">) =>
  api.post<Product>("/nutrition/products", data);

export const getMeals = (day: string) =>
  api.get<Meal[]>("/nutrition/meals", { params: { day } });

export const createMeal = (data: { date: string; meal_type: string; name?: string }) =>
  api.post<Meal>("/nutrition/meals", data);

export const addMealItem = (mealId: number, data: { product_id: number; amount_grams: number }) =>
  api.post<MealItem>(`/nutrition/meals/${mealId}/items`, data);

export const getDailyReport = (day: string) =>
  api.get<DailyReport>("/reports/daily", { params: { day } });

export const getWeeklyReport = () =>
  api.get<WeeklyReport>("/reports/weekly");

export const getClientWeeklyReport = (userId: number) =>
  api.get<WeeklyReport>(`/reports/users/${userId}/weekly`);

export const getClientPeriodReport = (
  userId: number,
  options: { days?: number; from?: string; to?: string },
) => {
  const params: Record<string, string | number> = {};
  if (options.days != null) params.days = options.days;
  if (options.from) params.date_from = options.from;
  if (options.to) params.date_to = options.to;
  return api.get<PeriodReport>(`/reports/users/${userId}/nutrition`, { params });
};

export const getRangeReport = (params: { from: string; to: string }) =>
  api.get<RangeReport>("/reports/range", { params });

export const getSummaryReport = (params: { from: string; to: string }) =>
  api.get<SummaryReport>("/reports/summary", { params });

// --- AI meal recognition --- //

export const analyzeMealText = (text: string) =>
  api.post<MealAnalysis>("/nutrition/analyze/text", { text });

export const analyzeMealPhoto = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post<MealAnalysis>("/nutrition/analyze/photo", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const analyzeMealVoice = (file: Blob, filename = "voice.webm") => {
  const fd = new FormData();
  fd.append("file", file, filename);
  return api.post<VoiceAnalysis>("/nutrition/analyze/voice", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const confirmAnalysis = (
  mealId: number,
  data: {
    dish_name: string;
    estimated_weight: number;
    calories: number;
    proteins: number;
    fats: number;
    carbs: number;
  },
) => api.post<MealItem>(`/nutrition/analyze/${mealId}/confirm`, data);
