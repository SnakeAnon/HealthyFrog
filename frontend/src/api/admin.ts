import { AdminStats, AdminUserUpdate, AuditLog, Role, User } from "../types";
import api from "./client";

export interface ListUsersParams {
  role?: Role;
  search?: string;
  limit?: number;
  offset?: number;
}

export const listUsers = (params: ListUsersParams = {}) => {
  const query: Record<string, string | number> = {};
  if (params.role) query.role = params.role;
  if (params.search) query.search = params.search;
  if (params.limit != null) query.limit = params.limit;
  if (params.offset != null) query.offset = params.offset;
  return api.get<User[]>("/admin/users", { params: query });
};

export const getUser = (id: number) => api.get<User>(`/admin/users/${id}`);

export const updateUser = (id: number, body: AdminUserUpdate) =>
  api.patch<User>(`/admin/users/${id}`, body);

export const deleteUser = (id: number) =>
  api.delete<void>(`/admin/users/${id}`);

export const getStats = () => api.get<AdminStats>("/admin/stats");

export interface AdminAuditParams {
  user_id?: number;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export const getAudit = (params: AdminAuditParams = {}) => {
  const query: Record<string, string | number> = {};
  if (params.user_id != null) query.user_id = params.user_id;
  if (params.action) query.action = params.action;
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;
  if (params.limit != null) query.limit = params.limit;
  if (params.offset != null) query.offset = params.offset;
  return api.get<AuditLog[]>("/admin/audit", { params: query });
};
