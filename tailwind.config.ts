import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#252331",
          secondary: "#706C7D",
          muted: "#9994A5",
        },
        paper: "#F5F2F7",
        surface: {
          DEFAULT: "rgba(255, 255, 255, 0.82)",
          elevated: "rgba(255, 255, 255, 0.94)",
          pure: "#FFFFFF",
          pearl: "#FAF9FC",
        },
        sidebar: "rgba(250, 249, 252, 0.80)",
        border: "rgba(74, 61, 100, 0.10)",
        primary: {
          DEFAULT: "#B8944E",
          hover: "#9F7D3E",
          light: "#D6BD88",
          dark: "#80642F",
          tint: "rgba(184, 148, 78, 0.10)",
          focus: "rgba(184, 148, 78, 0.14)",
          subtle: "rgba(184, 148, 78, 0.09)",
        },
        accent: {
          DEFAULT: "#B8944E",
          hover: "#9F7D3E",
          secondary: "#F1DDE8",
          blue: "#DFE9F5",
        },
        lavender: {
          DEFAULT: "#E9E3F4",
          light: "rgba(233, 227, 244, 0.50)",
        },
        rose: {
          DEFAULT: "#F1DDE8",
        },
        blue: {
          subtle: "#DFE9F5",
        },
        champagne: {
          DEFAULT: "#F3E8D7",
        },
        status: {
          success: "#2E8B70",
          error: "#C25D72",
          warning: "#A87936",
          info: "#557CB4",
        },
      },
      boxShadow: {
        glass: "0 8px 30px rgba(70, 55, 95, 0.055)",
        "glass-elevated": "0 12px 35px rgba(70, 55, 95, 0.08)",
        toast: "0 12px 35px rgba(70, 55, 95, 0.12)",
        modal: "0 25px 70px rgba(70, 55, 95, 0.16)",
        dropdown: "0 15px 40px rgba(70, 55, 95, 0.12)",
        card: "0 8px 30px rgba(70, 55, 95, 0.055)",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
