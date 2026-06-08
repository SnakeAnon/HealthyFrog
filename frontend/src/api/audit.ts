import { AuditLog } from "../types";
import api from "./client";

export const listMyAudit = (limit = 20, offset = 0) =>
  api.get<AuditLog[]>("/users/me/audit", { params: { limit, offset } });
