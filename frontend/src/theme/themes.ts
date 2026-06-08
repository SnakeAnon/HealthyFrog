import { createTheme } from "@mui/material/styles";

const FONT = '"Inter", "Roboto", "Helvetica", "Arial", sans-serif';
const RADIUS = 18;

const typography = {
  fontFamily: FONT,
  h3: { fontWeight: 800, letterSpacing: "-0.025em" },
  h4: { fontWeight: 800, letterSpacing: "-0.02em" },
  h5: { fontWeight: 700, letterSpacing: "-0.01em" },
  h6: { fontWeight: 700 },
  subtitle1: { fontWeight: 600 },
  subtitle2: { fontWeight: 600 },
  button: { fontWeight: 700, letterSpacing: 0.2, textTransform: "none" as const },
  overline: { letterSpacing: "0.1em", fontWeight: 600 },
};

function sharedComponents(light: boolean) {
  const border = light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)";
  const paperBg = light ? "#ffffff" : "#121816";
  const shadow = light
    ? "0 2px 16px rgba(0,0,0,0.07)"
    : "0 4px 24px rgba(0,0,0,0.45)";

  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: "thin",
          scrollbarColor: light ? "rgba(0,0,0,0.2) transparent" : "rgba(255,255,255,0.15) transparent",
        },
        "*": { boxSizing: "border-box" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${border}`,
          boxShadow: shadow,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        elevation1: { boxShadow: shadow },
        elevation3: { boxShadow: light ? "0 8px 32px rgba(0,0,0,0.12)" : "0 8px 32px rgba(0,0,0,0.55)" },
      },
    },
    MuiAppBar: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultProps: { elevation: 0, color: "default" as any },
      styleOverrides: {
        root: {
          backgroundColor: light ? "rgba(255,255,255,0.85)" : "rgba(12,20,16,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid ${border}`,
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: light ? "rgba(255,255,255,0.9)" : "rgba(12,20,16,0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: `1px solid ${border}`,
          height: 64,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 0,
          paddingTop: 6,
          color: light ? "rgba(0,0,0,0.38)" : "rgba(255,255,255,0.38)",
          "&.Mui-selected": { color: light ? "#18a058" : "#5ad98a" },
        },
        label: {
          fontSize: "0.63rem",
          "&.Mui-selected": { fontSize: "0.63rem" },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          backgroundColor: paperBg,
          border: `1px solid ${border}`,
          borderRadius: RADIUS + 2,
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: light
            ? "0 6px 24px rgba(24,160,88,0.40)"
            : "0 6px 24px rgba(90,217,138,0.40)",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 6, height: 7 },
        bar: { borderRadius: 6 },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12 },
        containedPrimary: {
          background: light
            ? "linear-gradient(135deg, #18a058 0%, #0d7a3f 100%)"
            : "linear-gradient(135deg, #5ad98a 0%, #2fa060 100%)",
          boxShadow: "none",
          "&:hover": { boxShadow: "none", filter: "brightness(1.1)" },
        },
        outlined: { borderWidth: 1.5, "&:hover": { borderWidth: 1.5 } },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined" as const },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            "& fieldset": { borderWidth: 1.5 },
            "&:hover fieldset": { borderWidth: 1.5 },
            "&.Mui-focused fieldset": { borderWidth: 2 },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 10 } },
    },
  };
}

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#5ad98a", dark: "#2fa060", light: "#8bf0b0", contrastText: "#041a0d" },
    secondary: { main: "#7eb8ff", dark: "#4a8de8", light: "#aad4ff" },
    warning: { main: "#ffb347", light: "#ffd080" },
    info: { main: "#7eb8ff" },
    error: { main: "#ff6b6b", light: "#ff9999" },
    success: { main: "#5ad98a" },
    background: { default: "#080e0b", paper: "#111916" },
    text: { primary: "rgba(255,255,255,0.92)", secondary: "rgba(255,255,255,0.52)" },
    divider: "rgba(255,255,255,0.07)",
  },
  shape: { borderRadius: RADIUS },
  typography,
  components: sharedComponents(false),
});

export const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#18a058", dark: "#0d7a3f", light: "#4bc87e", contrastText: "#ffffff" },
    secondary: { main: "#3b82f6", dark: "#1d4ed8", light: "#60a5fa" },
    warning: { main: "#f59e0b", light: "#fbbf24" },
    info: { main: "#3b82f6" },
    error: { main: "#ef4444", light: "#f87171" },
    success: { main: "#18a058" },
    background: { default: "#eef7f2", paper: "#ffffff" },
    text: { primary: "rgba(0,0,0,0.87)", secondary: "rgba(0,0,0,0.52)" },
    divider: "rgba(0,0,0,0.08)",
  },
  shape: { borderRadius: RADIUS },
  typography,
  components: sharedComponents(true),
});
