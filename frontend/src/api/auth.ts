import api from "./client";

export const register = (data: {
  email: string;
  password: string;
  name: string;
  role: string;
}) => api.post<{ access_token: string; token_type: string }>("/auth/register", data);

export const login = (data: { email: string; password: string }) =>
  api.post<{ access_token: string; token_type: string }>("/auth/login", data);
