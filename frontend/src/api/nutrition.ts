import { DailyReport, Meal, MealItem, Product } from "../types";
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
