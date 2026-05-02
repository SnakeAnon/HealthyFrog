import BookIcon from "@mui/icons-material/MenuBook";
import CalendarIcon from "@mui/icons-material/CalendarMonth";
import ChatIcon from "@mui/icons-material/Chat";
import HomeIcon from "@mui/icons-material/Home";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Home", icon: <HomeIcon /> },
  { path: "/diary", label: "Diary", icon: <BookIcon /> },
  { path: "/trainers", label: "Coaches", icon: <PeopleIcon /> },
  { path: "/chat", label: "Chat", icon: <ChatIcon /> },
  { path: "/bookings", label: "Book", icon: <CalendarIcon /> },
  { path: "/profile", label: "Profile", icon: <PersonIcon /> },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const currentIndex = NAV_ITEMS.findIndex((item) => location.pathname.startsWith(item.path));

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
          <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 800, letterSpacing: -0.3 }}>
            🐸 Healthy Frog
          </Typography>
          <IconButton color="inherit" onClick={logout} size="small" title="Logout" edge="end">
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
          pb: "calc(72px + env(safe-area-inset-bottom, 0px))",
          maxWidth: 480,
          mx: "auto",
          width: "100%",
        }}
      >
        <Outlet />
      </Box>

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
          onChange={(_, val) => navigate(NAV_ITEMS[val].path)}
          showLabels
        >
          {NAV_ITEMS.map((item) => (
            <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} />
          ))}
        </BottomNavigation>
      </Box>
    </Box>
  );
}
