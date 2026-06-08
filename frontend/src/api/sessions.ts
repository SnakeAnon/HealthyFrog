import { Session } from "../types";
import api from "./client";

export const listMySessions = () => api.get<Session[]>("/users/me/sessions");

export const revokeSession = (id: number) =>
  api.delete<void>(`/users/me/sessions/${id}`);
