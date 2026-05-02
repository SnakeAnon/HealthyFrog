export type Role = "user" | "trainer";

export interface User {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  age: number | null;
  height: number | null;
  weight: number | null;
  goal: string | null;
  bio: string | null;
  specialty: string | null;
  trainer_id: number | null;
  created_at: string;
}

export interface Trainer {
  id: number;
  email: string;
  name: string | null;
  bio: string | null;
  specialty: string | null;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Product {
  id: number;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
}

export interface MealItem {
  id: number;
  product_id: number;
  product: Product;
  amount_grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Meal {
  id: number;
  user_id: number;
  date: string;
  meal_type: MealType;
  name: string | null;
  items: MealItem[];
  total_calories: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
  created_at: string;
}

export interface DailyReport {
  date: string;
  total_calories: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
  meals: Meal[];
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
}

export type BookingStatus = "pending" | "confirmed" | "cancelled";

export interface TimeSlot {
  id: number;
  trainer_id: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface Booking {
  id: number;
  slot_id: number;
  user_id: number;
  status: BookingStatus;
  slot: TimeSlot;
  created_at: string;
}
