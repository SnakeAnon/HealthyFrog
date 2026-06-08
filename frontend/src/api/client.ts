import axios from "axios";

import { triggerUnauthorized } from "../sessionSync";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatApiErrorDetail(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== "object") return fallback;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          const msg = String((item as { msg: unknown }).msg);
          const loc = (item as { loc?: unknown }).loc;
          const tail = Array.isArray(loc) ? loc.slice(1).join(".") : "";
          return tail ? `${tail}: ${msg}` : msg;
        }
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const path = String(err.config?.url ?? "");
      const isLogoutCall = path.includes("/auth/logout");
      if (!isLogoutCall) {
        triggerUnauthorized();
      }
    }
    return Promise.reject(err);
  }
);

export default api;

/** Build WebSocket URL for `/ws/chat` etc. Prefer same-origin + Vite `/api` proxy (ws: true). */
export function wsUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const explicit = import.meta.env.VITE_WS_URL?.trim();
  if (explicit) {
    const base = explicit.replace(/\/$/, "");
    return `${base}${normalized}`;
  }
  if (typeof window !== "undefined") {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${window.location.host}/api/v1${normalized}`;
  }
  return `ws://127.0.0.1:8000/api/v1${normalized}`;
}
