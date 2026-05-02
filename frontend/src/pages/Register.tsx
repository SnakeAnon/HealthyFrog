import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register as registerApi } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "user" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await registerApi(form);
      login(res.data.access_token);
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        "Registration failed.";
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
          Create Account
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
          <TextField label="Full Name" value={form.name} onChange={set("name")} required fullWidth />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={set("email")}
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={form.password}
            onChange={set("password")}
            required
            fullWidth
            inputProps={{ minLength: 6 }}
          />
          <FormControl fullWidth>
            <InputLabel>I am a…</InputLabel>
            <Select
              value={form.role}
              label="I am a…"
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <MenuItem value="user">User (I want to track my nutrition)</MenuItem>
              <MenuItem value="trainer">Trainer (I work with clients)</MenuItem>
            </Select>
          </FormControl>
          <Button type="submit" variant="contained" fullWidth disabled={loading} size="large">
            {loading ? "Creating account…" : "Create Account"}
          </Button>
          <Typography variant="body2" align="center">
            Already have an account?{" "}
            <Link to="/login" style={{ color: "inherit", fontWeight: 600 }}>
              Sign In
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
