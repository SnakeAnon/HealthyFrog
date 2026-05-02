import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login as loginApi } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await loginApi({ email, password });
      login(res.data.access_token);
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        "Login failed. Check your credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, width: "100%", maxWidth: 400 }} elevation={3}>
        <Typography variant="h4" align="center" fontWeight={700} mb={0.5}>
          🐸
        </Typography>
        <Typography variant="h6" align="center" fontWeight={700} mb={3}>
          Healthy Frog
        </Typography>

        <Typography variant="h6" mb={2}>
          Sign In
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoComplete="email"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            autoComplete="current-password"
          />
          <Button type="submit" variant="contained" fullWidth disabled={loading} size="large">
            {loading ? "Signing in…" : "Sign In"}
          </Button>
          <Typography variant="body2" align="center">
            No account?{" "}
            <Link to="/register" style={{ color: "inherit", fontWeight: 600 }}>
              Register
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
