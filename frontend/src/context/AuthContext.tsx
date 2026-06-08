import React, { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { logout as logoutApi } from "../api/auth";
import { getMe } from "../api/users";
import { registerUnauthorizedHandler } from "../sessionSync";
import { User } from "../types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  isTrainer: boolean;
  login: (token: string) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await getMe();
      setUser(res.data);
    } catch {
      setUser(null);
    }
  };

  // SPA session clear on 401 (axios) — avoids ``window.location`` blank screen.
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      navigate("/login", { replace: true });
    });
    return () => registerUnauthorizedHandler(null);
  }, [navigate]);

  useEffect(() => {
    if (token) {
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = (newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  };

  const logout = async () => {
    // Best-effort revocation of the current token. Network/401 errors are
    // swallowed because the local cleanup below is the source of truth.
    try {
      await logoutApi();
    } catch {
      /* ignore */
    }
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === "admin";
  const isTrainer = user?.role === "trainer";

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, isAdmin, isTrainer, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
