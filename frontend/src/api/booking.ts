import { Booking, TimeSlot } from "../types";
import api from "./client";

export const getAvailableSlots = (trainerId: number) =>
  api.get<TimeSlot[]>(`/bookings/slots/${trainerId}`);

export const getMySlots = () => api.get<TimeSlot[]>("/bookings/my-slots");

export const createSlot = (data: { start_time: string; end_time: string }) =>
  api.post<TimeSlot>("/bookings/slots", data);

export const bookSlot = (slotId: number) =>
  api.post<Booking>("/bookings/", { slot_id: slotId });

export const getMyBookings = () => api.get<Booking[]>("/bookings/my");

export const getTrainerBookings = () => api.get<Booking[]>("/bookings/trainer-bookings");

export const updateBookingStatus = (bookingId: number, status: string) =>
  api.patch<Booking>(`/bookings/${bookingId}/status`, { status });
