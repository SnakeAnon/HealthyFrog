import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

export function wsUrl(path: string): string {
  const base = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/api/v1";
  return `${base}${path}`;
}
