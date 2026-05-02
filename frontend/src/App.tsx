import { Box, CircularProgress } from "@mui/material";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Bookings from "./pages/Bookings";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Diary from "./pages/Diary";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Register from "./pages/Register";
import Trainers from "./pages/Trainers";
import { mobileDarkTheme } from "./theme/mobileDarkTheme";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading)
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="trainers" element={<Trainers />} />
        <Route path="diary" element={<Diary />} />
        <Route path="chat" element={<Chat />} />
        <Route path="bookings" element={<Bookings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={mobileDarkTheme}>
      <CssBaseline enableColorScheme />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
