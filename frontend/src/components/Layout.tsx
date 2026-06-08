import AddIcon from "@mui/icons-material/Add";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import BookIcon from "@mui/icons-material/MenuBook";
import CalendarIcon from "@mui/icons-material/CalendarMonth";
import ChatIcon from "@mui/icons-material/Chat";
import HomeIcon from "@mui/icons-material/Home";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Fab,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import { useThemeMode } from "../context/ThemeContext";
import { ReactElement, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { QuickAddSheet } from "./nutrition";

interface NavItem {
  path: string;
  label: string;
  icon: ReactElement;
}

// Reports live inside Diary (button «Отчёты»). Bottom nav stays at 6 slots for
// users (FAB carve-out uses dynamic nth-child — see fabLeftSlot below).
const BASE_NAV: NavItem[] = [
  { path: "/dashboard", label: "Главная", icon: <HomeIcon /> },
  { path: "/diary", label: "Дневник", icon: <BookIcon /> },
  { path: "/trainers", label: "Тренеры", icon: <PeopleIcon /> },
  { path: "/chat", label: "Чат", icon: <ChatIcon /> },
  { path: "/bookings", label: "Запись", icon: <CalendarIcon /> },
  { path: "/profile", label: "Профиль", icon: <PersonIcon /> },
];

const ADMIN_ITEM: NavItem = {
  path: "/admin",
  label: "Админ",
  icon: <AdminPanelSettingsIcon />,
};

export interface LayoutOutletContext {
  /** Increments after a quick-add success — children re-fetch when this changes. */
  refreshTick: number;
  openQuickAdd: () => void;
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isAdmin, isTrainer } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const [quickOpen, setQuickOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const navItems: NavItem[] = useMemo(() => {
    const mapped = BASE_NAV.map((item) => {
      if (item.path === "/trainers") {
        if (isAdmin) return ADMIN_ITEM;
        if (isTrainer) return { ...item, label: "Клиенты" };
      }
      return item;
    });
    if (isTrainer) {
      return mapped.filter((i) => i.path !== "/bookings");
    }
    return mapped;
  }, [isAdmin, isTrainer]);

  const fabLeftSlot = Math.ceil(navItems.length / 2);

  const currentIndex = navItems.findIndex((item) => location.pathname.startsWith(item.path));

  const outletContext: LayoutOutletContext = {
    refreshTick,
    openQuickAdd: () => setQuickOpen(true),
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <AppBar position="sticky">
        <Toolbar variant="dense" sx={{ minHeight: 48 }}>
          <Typography
            variant="subtitle1"
            sx={{
              flexGrow: 1,
              fontWeight: 800,
              letterSpacing: -0.3,
              background: (t) =>
                t.palette.mode === "dark"
                  ? "linear-gradient(90deg, #8bf0b0, #5ad98a)"
                  : "linear-gradient(90deg, #0d7a3f, #18a058)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            🐸 Healthy Frog
          </Typography>
          <IconButton
            onClick={toggleMode}
            size="small"
            title={mode === "dark" ? "Светлая тема" : "Тёмная тема"}
            sx={{ mr: 0.5 }}
          >
            {mode === "dark" ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
          <IconButton
            color="inherit"
            onClick={() => { void logout(); }}
            size="small"
            title="Выйти"
            edge="end"
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: 2,
          py: 2,
          pb: "calc(96px + env(safe-area-inset-bottom, 0px))",
          maxWidth: 480,
          mx: "auto",
          width: "100%",
        }}
      >
        <Outlet context={outletContext} />
      </Box>

      <Fab
        color="primary"
        aria-label="Быстро добавить приём пищи"
        onClick={() => setQuickOpen(true)}
        sx={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "calc(40px + env(safe-area-inset-bottom, 0px))",
          zIndex: (t) => t.zIndex.appBar + 2,
          width: 60,
          height: 60,
          boxShadow: "0 8px 28px rgba(90, 217, 138, 0.45)",
        }}
      >
        <AddIcon sx={{ fontSize: 30 }} />
      </Fab>

      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.appBar,
        }}
      >
        <BottomNavigation
          value={currentIndex === -1 ? false : currentIndex}
          onChange={(_, val) => navigate(navItems[val].path)}
          showLabels
          sx={{
            [`& .MuiBottomNavigationAction-root:nth-of-type(${fabLeftSlot})`]: {
              marginRight: "44px",
            },
            [`& .MuiBottomNavigationAction-root:nth-of-type(${fabLeftSlot + 1})`]: {
              marginLeft: "44px",
            },
          }}
        >
          {navItems.map((item) => (
            <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} />
          ))}
        </BottomNavigation>
      </Box>

      <QuickAddSheet
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onSaved={() => setRefreshTick((t) => t + 1)}
      />
    </Box>
  );
}
