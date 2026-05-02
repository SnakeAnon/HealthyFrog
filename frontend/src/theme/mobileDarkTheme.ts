import { createTheme } from "@mui/material/styles";

/**
 * Dark, mobile-first theme for a nutrition-style app: elevated cards, green accent, readable contrast.
 */
export const mobileDarkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#5ad98a",
      dark: "#2fa060",
      light: "#8bf0b0",
      contrastText: "#0a0f0d",
    },
    secondary: {
      main: "#7eb8ff",
    },
    background: {
      default: "#0a0e0c",
      paper: "#141a17",
    },
    text: {
      primary: "rgba(255,255,255,0.92)",
      secondary: "rgba(255,255,255,0.58)",
    },
    divider: "rgba(255,255,255,0.08)",
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h3: { fontWeight: 800, letterSpacing: "-0.02em" },
    h6: { fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: "rgba(255,255,255,0.2) transparent",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid",
          borderColor: "rgba(255,255,255,0.07)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: "default",
      },
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          borderTop: `1px solid ${theme.palette.divider}`,
          height: 64,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }),
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 0,
          paddingTop: 6,
          color: "rgba(255,255,255,0.45)",
          "&.Mui-selected": {
            color: "primary.main",
          },
        },
        label: {
          fontSize: "0.65rem",
          "&.Mui-selected": { fontSize: "0.65rem" },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 8 },
      },
    },
  },
});
