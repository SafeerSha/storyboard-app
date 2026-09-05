import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        paper: "#f7f7f5",
        line: "#e7e5e0",
        accent: "#5b5bd6"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,.04), 0 8px 30px rgba(0,0,0,.04)"
      }
    }
  },
  plugins: []
};
export default config;
