import { Trainer, User } from "../types";
import api from "./client";

export const getMe = () => api.get<User>("/users/me");

export const updateMe = (data: Partial<User>) => api.put<User>("/users/me", data);

export const getTrainers = () => api.get<Trainer[]>("/users/trainers");

export const getTrainer = (id: number) => api.get<Trainer>(`/users/trainers/${id}`);

export const assignTrainer = (trainerId: number) =>
  api.post<User>(`/users/me/trainer/${trainerId}`);

export const getMyClients = () => api.get<User[]>("/users/my-clients");

// Re-export weight helpers for backwards compatibility.
export { getWeightHistory, getWeightTrend, recordWeight } from "./weight";
