export type Role = "user" | "trainer" | "admin";

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

export interface DailySummary {
  date: string;
  total_calories: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
  meals: Meal[];
}

export interface PeriodReport {
  user_id: number;
  period_start: string;
  period_end: string;
  total_calories: number;
  total_proteins: number;
  total_fats: number;
  total_carbs: number;
  average_daily_calories: number;
  days_with_data: number;
  days: DailySummary[];
}

export interface WeeklyReport extends PeriodReport {
  summary: string | null;
}

export interface AnalysisIngredient {
  name: string;
  amount_grams: number | null;
}

export interface MealAnalysis {
  dish_name: string;
  ingredients: AnalysisIngredient[];
  estimated_weight: number;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  confidence: number | null;
  notes: string | null;
}

export interface VoiceAnalysis extends MealAnalysis {
  transcribed_text: string;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Dialog {
  other_user_id: number;
  other_user_name: string | null;
  unread_count: number;
  last_message: Message | null;
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

export interface WeightLog {
  id: number;
  user_id: number;
  date: string;
  weight: number;
  recorded_at: string;
}

export interface WeightTrend {
  days: number;
  entries: number;
  first_weight: number | null;
  last_weight: number | null;
  delta: number | null;
  avg_change_per_day: number | null;
}

export interface DailyTotals {
  date: string;
  total_calories: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
}

export interface RangeReport {
  period_start: string;
  period_end: string;
  days: DailyTotals[];
}

export interface SummaryReport {
  period_start: string;
  period_end: string;
  days_total: number;
  days_logged: number;
  total_calories: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
  avg_calories: number;
  avg_protein: number;
  avg_fat: number;
  avg_carbs: number;
  min_calories: number;
  max_calories: number;
}

export interface Session {
  id: number;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  user_agent: string | null;
  ip: string | null;
  revoked: boolean;
}

export interface RevokeResponse {
  revoked: number;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  payload: unknown | null;
  created_at: string;
}

export interface AnalysisIngredientItem {
  name: string;
  amount_grams: number | null;
}

export interface AnalysisResponse {
  dish_name: string;
  ingredients: AnalysisIngredientItem[];
  estimated_weight: number;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  confidence: number | null;
  notes: string | null;
}

export interface VoiceAnalysisResponse extends AnalysisResponse {
  transcribed_text: string;
}

export interface AnalysisConfirm {
  dish_name: string;
  estimated_weight: number;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
}

export interface AdminStats {
  total_users: number;
  users_by_role: Record<string, number>;
  products: number;
  meals: number;
  messages: number;
  bookings: number;
}

export interface AdminUserUpdate {
  name?: string | null;
  age?: number | null;
  height?: number | null;
  weight?: number | null;
  goal?: string | null;
  bio?: string | null;
  specialty?: string | null;
  role?: Role;
  trainer_id?: number | null;
}
