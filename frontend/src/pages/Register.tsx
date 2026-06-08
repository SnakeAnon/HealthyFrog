import {
  Alert,
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion, AnimatePresence } from "framer-motion";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

import { register as registerApi } from "../api/auth";
import { formatApiErrorDetail } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";

export default function Register() {
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "user" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const dark = mode === "dark";

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await registerApi({ ...form, name: form.name.trim(), email: form.email.trim() });
      login(res.data.access_token);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(formatApiErrorDetail(err, "Не удалось зарегистрироваться."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        bgcolor: "background.default",
        px: 2,
        py: 3,
      }}
    >
      {/* Blobs */}
      <Box sx={{
        position: "absolute", top: "-15%", right: "-10%",
        width: "55vw", height: "55vw", maxWidth: 320, maxHeight: 320,
        borderRadius: "50%", pointerEvents: "none",
        background: dark
          ? "radial-gradient(circle, rgba(90,217,138,0.15) 0%, transparent 70%)"
          : "radial-gradient(circle, rgba(24,160,88,0.16) 0%, transparent 70%)",
      }} />
      <Box sx={{
        position: "absolute", bottom: "-12%", left: "-15%",
        width: "55vw", height: "55vw", maxWidth: 300, maxHeight: 300,
        borderRadius: "50%", pointerEvents: "none",
        background: dark
          ? "radial-gradient(circle, rgba(126,184,255,0.10) 0%, transparent 70%)"
          : "radial-gradient(circle, rgba(59,130,246,0.11) 0%, transparent 70%)",
      }} />

      {/* Theme toggle */}
      <Box sx={{ position: "absolute", top: 16, right: 16 }}>
        <IconButton onClick={toggleMode} size="small" sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
          {dark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Logo */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 18 }}
        style={{ marginBottom: 8 }}
      >
        <Box sx={{
          width: 64, height: 64, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "2.1rem",
          background: dark ? "linear-gradient(145deg, #1e3a2a, #0e1e15)" : "linear-gradient(145deg, #d4f5e4, #a8eac4)",
          border: "2px solid", borderColor: "primary.dark",
        }}>
          🐸
        </Box>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
      >
        <Typography
          variant="h6"
          fontWeight={800}
          align="center"
          sx={{
            mb: 2.5,
            background: dark
              ? "linear-gradient(135deg, #8bf0b0, #5ad98a 55%, #7eb8ff)"
              : "linear-gradient(135deg, #0d7a3f, #18a058 55%, #3b82f6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Healthy Frog
        </Typography>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.45, ease: "easeOut" }}
        style={{ width: "100%", maxWidth: 400 }}
      >
        <Box sx={{
          bgcolor: "background.paper",
          borderRadius: 3,
          border: "1px solid",
          borderColor: dark ? "rgba(90,217,138,0.12)" : "rgba(24,160,88,0.12)",
          boxShadow: dark ? "0 8px 40px rgba(0,0,0,0.55)" : "0 8px 40px rgba(0,0,0,0.09)",
          p: { xs: 3, sm: 3.5 },
        }}>
          <Typography variant="h6" fontWeight={700} mb={0.5}>
            Создать аккаунт
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2.5}>
            Присоединяйтесь к Healthy Frog
          </Typography>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.22 }}
              >
                <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Имя и фамилия"
                value={form.name}
                onChange={set("name")}
                required
                fullWidth
                autoFocus
              />
              <TextField
                label="Электронная почта"
                type="email"
                value={form.email}
                onChange={set("email")}
                required
                fullWidth
                autoComplete="email"
              />
              <TextField
                label="Пароль"
                type="password"
                value={form.password}
                onChange={set("password")}
                required
                fullWidth
                inputProps={{ minLength: 6 }}
                autoComplete="new-password"
              />
              <FormControl fullWidth>
                <InputLabel>Кто я</InputLabel>
                <Select
                  value={form.role}
                  label="Кто я"
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  sx={{ borderRadius: "12px !important" }}
                >
                  <MenuItem value="user">Пользователь — веду дневник питания</MenuItem>
                  <MenuItem value="trainer">Тренер — работаю с клиентами</MenuItem>
                </Select>
              </FormControl>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ mt: 0.5, py: 1.4, fontSize: "1rem", fontWeight: 700 }}
              >
                {loading ? "Создаю аккаунт…" : "Зарегистрироваться"}
              </Button>
            </Stack>
          </Box>

          <Box sx={{ mt: 2.5, pt: 2.5, borderTop: "1px solid", borderColor: "divider", textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Уже есть аккаунт?{" "}
              <Link
                to="/login"
                style={{ color: theme.palette.primary.main, fontWeight: 700, textDecoration: "none" }}
              >
                Войти
              </Link>
            </Typography>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
}
