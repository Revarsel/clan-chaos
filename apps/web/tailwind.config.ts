import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: { 50: "#fffaf0", 100: "#fbf1dc", 200: "#f3e2bd", 300: "#e8cf98", 400: "#d9b46a" },
        bark: { 500: "#8a5a35", 600: "#6e4527", 700: "#55341d", 800: "#3d2514", 900: "#28180c" },
        moss: { 300: "#a8d68a", 400: "#7fbf5f", 500: "#5a9e3f", 600: "#43802d", 700: "#2f5f20" },
        ember: { 400: "#ff8a4c", 500: "#f26a2e", 600: "#d4501a" },
        royal: { 400: "#8f7cf7", 500: "#6c56e6", 600: "#5440c4" },
        gold: { 300: "#ffe38a", 400: "#ffd24d", 500: "#f2b51b" },
        sky: { 300: "#9fd8ff" },
      },
      fontFamily: {
        display: ['"Trebuchet MS"', '"Segoe UI Rounded"', "Nunito", "system-ui", "sans-serif"],
        body: ["system-ui", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 3px 0 rgba(61,37,20,0.35), 0 6px 14px rgba(40,24,12,0.25)",
        pop: "0 4px 0 rgba(61,37,20,0.5)",
      },
      keyframes: {
        pop: { "0%": { transform: "scale(0.8)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        slideUp: { "0%": { transform: "translateY(12px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        wiggle: { "0%,100%": { transform: "rotate(-3deg)" }, "50%": { transform: "rotate(3deg)" } },
        pulseRing: { "0%": { transform: "scale(0.9)", opacity: "0.8" }, "100%": { transform: "scale(1.6)", opacity: "0" } },
      },
      animation: {
        pop: "pop 0.25s ease-out",
        slideUp: "slideUp 0.3s ease-out",
        wiggle: "wiggle 1.2s ease-in-out infinite",
        pulseRing: "pulseRing 1.4s ease-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
