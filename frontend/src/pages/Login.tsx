import { Alert, Box, Button, IconButton, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

import { login as loginApi } from "../api/auth";
import { formatApiErrorDetail } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const dark = mode === "dark";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await loginApi({ email: email.trim(), password });
      login(res.data.access_token);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(formatApiErrorDetail(err, "Неверная почта или пароль."));
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
      }}
    >
      {/* Gradient blobs */}
      <Box sx={{
        position: "absolute", top: "-15%", left: "-20%",
        width: "65vw", height: "65vw", maxWidth: 360, maxHeight: 360,
        borderRadius: "50%", pointerEvents: "none",
        background: dark
          ? "radial-gradient(circle, rgba(90,217,138,0.17) 0%, transparent 70%)"
          : "radial-gradient(circle, rgba(24,160,88,0.18) 0%, transparent 70%)",
      }} />
      <Box sx={{
        position: "absolute", bottom: "-10%", right: "-15%",
        width: "55vw", height: "55vw", maxWidth: 300, maxHeight: 300,
        borderRadius: "50%", pointerEvents: "none",
        background: dark
          ? "radial-gradient(circle, rgba(126,184,255,0.11) 0%, transparent 70%)"
          : "radial-gradient(circle, rgba(59,130,246,0.13) 0%, transparent 70%)",
      }} />

      {/* Theme toggle */}
      <Box sx={{ position: "absolute", top: 16, right: 16 }}>
        <IconButton
          onClick={toggleMode}
          size="small"
          sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}
        >
          {dark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Logo */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0, y: -16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 18 }}
        style={{ marginBottom: 10 }}
      >
        <Box sx={{
          width: 80, height: 80, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "2.6rem",
          background: dark
            ? "linear-gradient(145deg, #1e3a2a, #0e1e15)"
            : "linear-gradient(145deg, #d4f5e4, #a8eac4)",
          border: "2px solid", borderColor: "primary.dark",
          boxShadow: dark
            ? "0 0 36px rgba(90,217,138,0.22)"
            : "0 0 28px rgba(24,160,88,0.18)",
        }}>
          🐸
        </Box>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.4 }}
      >
        <Typography
          variant="h5"
          fontWeight={800}
          align="center"
          sx={{
            mb: 3,
            background: dark
              ? "linear-gradient(135deg, #8bf0b0 0%, #5ad98a 55%, #7eb8ff 100%)"
              : "linear-gradient(135deg, #0d7a3f 0%, #18a058 55%, #3b82f6 100%)",
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
        transition={{ delay: 0.18, duration: 0.45, ease: "easeOut" }}
        style={{ width: "100%", maxWidth: 400 }}
      >
        <Box sx={{
          bgcolor: "background.paper",
          borderRadius: 3,
          border: "1px solid",
          borderColor: dark ? "rgba(90,217,138,0.12)" : "rgba(24,160,88,0.12)",
          boxShadow: dark
            ? "0 8px 40px rgba(0,0,0,0.55)"
            : "0 8px 40px rgba(0,0,0,0.09)",
          p: { xs: 3, sm: 3.5 },
        }}>
          <Typography variant="h6" fontWeight={700} mb={0.5}>
            Добро пожаловать
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2.5}>
            Войдите в свой аккаунт
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
                label="Электронная почта"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                autoComplete="email"
                autoFocus
              />
              <TextField
                label="Пароль"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPw((v) => !v)}
                        tabIndex={-1}
                        edge="end"
                      >
                        {showPw
                          ? <VisibilityOffIcon fontSize="small" />
                          : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ mt: 0.5, py: 1.4, fontSize: "1rem", fontWeight: 700 }}
              >
                {loading ? "Вхожу…" : "Войти"}
              </Button>
            </Stack>
          </Box>

          <Box sx={{ mt: 2.5, pt: 2.5, borderTop: "1px solid", borderColor: "divider", textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Нет аккаунта?{" "}
              <Link
                to="/register"
                style={{ color: theme.palette.primary.main, fontWeight: 700, textDecoration: "none" }}
              >
                Зарегистрироваться
              </Link>
            </Typography>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
}
