import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0F172A",
          secondary: "#334155",
          muted: "#64748B",
        },
        paper: "#F8F9FA",
        surface: {
          DEFAULT: "rgba(255, 255, 255, 0.90)",
          elevated: "rgba(255, 255, 255, 0.98)",
          pure: "#FFFFFF",
          pearl: "#F8F9FB",
        },
        sidebar: "rgba(248, 249, 252, 0.85)",
        border: "rgba(15, 23, 42, 0.08)",
        primary: {
          DEFAULT: "#CCA038",
          hover: "#B58422",
          light: "#E8C97E",
          dark: "#785312",
          tint: "rgba(204, 160, 56, 0.12)",
          focus: "rgba(204, 160, 56, 0.18)",
          subtle: "rgba(204, 160, 56, 0.08)",
        },
        accent: {
          DEFAULT: "#CCA038",
          hover: "#B58422",
          secondary: "#FDF2F8",
          blue: "#EFF6FF",
        },
        lavender: {
          DEFAULT: "#F1F5F9",
          light: "rgba(241, 245, 249, 0.60)",
        },
        rose: {
          DEFAULT: "#FFE4E6",
        },
        blue: {
          subtle: "#EFF6FF",
        },
        champagne: {
          DEFAULT: "#FEF3C7",
        },
        status: {
          success: "#059669",
          error: "#E11D48",
          warning: "#D97706",
          info: "#2563EB",
        },
      },
      boxShadow: {
        glass: "0 4px 20px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.03)",
        "glass-elevated": "0 10px 30px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.03)",
        toast: "0 12px 35px rgba(15, 23, 42, 0.12)",
        modal: "0 25px 70px rgba(15, 23, 42, 0.16)",
        dropdown: "0 15px 40px rgba(15, 23, 42, 0.12)",
        card: "0 1px 3px rgba(15, 23, 42, 0.04), 0 8px 24px -4px rgba(15, 23, 42, 0.06)",
        gold: "0 4px 20px rgba(204, 160, 56, 0.20)",
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
