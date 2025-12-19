import { createTheme, ThemeOptions } from "@mui/material/styles";
import { LinkProps } from "@mui/material/Link";
import LinkBehavior from "./LinkBehavior";

// Google Photos Logo Color Palette (from the actual logo)
const googlePhotosColors = {
  red: "#EA4335",      // Top-right semicircle
  yellow: "#FBBC04",   // Top-left semicircle  
  green: "#34A853",    // Bottom-left semicircle
  blue: "#4285F4",     // Bottom-right semicircle
  background: {
    dark: "#202124",
    light: "#FFFFFF",
  },
  surface: {
    dark: "#303134",
    light: "#F8F9FA",
  },
  text: {
    dark: "#E8EAED",
    light: "#202124",
  },
  border: {
    dark: "#5F6368",
    light: "#DADCE0",
  },
};

export const createAppTheme = (mode: "light" | "dark") => {
  const isDark = mode === "dark";

  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: googlePhotosColors.blue,
        light: "#669DF6",
        dark: "#1A73E8",
      },
      secondary: {
        main: googlePhotosColors.red,
      },
      background: {
        default: isDark
          ? googlePhotosColors.background.dark
          : googlePhotosColors.background.light,
        paper: isDark
          ? googlePhotosColors.surface.dark
          : googlePhotosColors.surface.light,
      },
      text: {
        primary: isDark
          ? googlePhotosColors.text.dark
          : googlePhotosColors.text.light,
        secondary: isDark ? "#9AA0A6" : "#5F6368",
      },
      divider: isDark
        ? googlePhotosColors.border.dark
        : googlePhotosColors.border.light,
      success: {
        main: googlePhotosColors.green,
      },
      warning: {
        main: googlePhotosColors.yellow,
      },
      error: {
        main: googlePhotosColors.red,
      },
      info: {
        main: googlePhotosColors.blue,
      },
    },
    typography: {
      fontFamily: [
        '"Google Sans"',
        '"Google Sans Display"',
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        '"Helvetica Neue"',
        "Arial",
        "sans-serif",
      ].join(","),
      h1: {
        fontWeight: 400,
        fontSize: "2.5rem",
        lineHeight: 1.2,
      },
      h2: {
        fontWeight: 400,
        fontSize: "2rem",
        lineHeight: 1.3,
      },
      h3: {
        fontWeight: 500,
        fontSize: "1.75rem",
        lineHeight: 1.4,
      },
      h4: {
        fontWeight: 500,
        fontSize: "1.5rem",
        lineHeight: 1.4,
      },
      h5: {
        fontWeight: 500,
        fontSize: "1.25rem",
        lineHeight: 1.5,
      },
      h6: {
        fontWeight: 500,
        fontSize: "1.125rem",
        lineHeight: 1.5,
      },
      body1: {
        fontSize: "1rem",
        lineHeight: 1.5,
      },
      body2: {
        fontSize: "0.875rem",
        lineHeight: 1.5,
      },
      button: {
        textTransform: "none",
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiLink: {
        defaultProps: {
          component: LinkBehavior,
        } as LinkProps,
      },
      MuiButtonBase: {
        defaultProps: {
          LinkComponent: LinkBehavior,
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            boxShadow: isDark
              ? "0 2px 8px rgba(0,0,0,0.3)"
              : "0 2px 8px rgba(0,0,0,0.1)",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 24,
            padding: "10px 24px",
            fontWeight: 500,
            transition: "all 0.3s ease",
            "&:hover": {
              transform: "translateY(-2px)",
            },
            "&:active": {
              transform: "translateY(0)",
            },
          },
          contained: {
            boxShadow: isDark
              ? "0 4px 12px rgba(66, 133, 244, 0.4)"
              : "0 4px 12px rgba(66, 133, 244, 0.3)",
            "&:hover": {
              boxShadow: isDark
                ? "0 6px 20px rgba(66, 133, 244, 0.6)"
                : "0 6px 20px rgba(66, 133, 244, 0.5)",
            },
          },
          outlined: {
            "&:hover": {
              borderWidth: 2,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: isDark
              ? "rgba(32, 33, 36, 0.8)"
              : "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(10px)",
            boxShadow: isDark
              ? "0 2px 8px rgba(0,0,0,0.3)"
              : "0 2px 8px rgba(0,0,0,0.1)",
          },
        },
      },
    },
  };

  return createTheme(themeOptions);
};
