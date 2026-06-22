/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: "#0a0e17",
        secondary: "#111827",
        card: "#1a1f2e",
        hover: "#232a3b",
        gold: "#f0b90b",
        "gold-dim": "rgba(240, 185, 11, 0.15)",
        up: "#00c087",
        "up-dim": "rgba(0, 192, 135, 0.12)",
        down: "#f6465d",
        "down-dim": "rgba(246, 70, 93, 0.12)",
        muted: "#848e9c",
        dimmed: "#5e6673",
        border: "#2b3139",
      },
      fontFamily: {
        display: ["Orbitron", "sans-serif"],
        body: ["Noto Sans SC", "sans-serif"],
      },
      animation: {
        shimmer: "shimmer 2s infinite",
        "card-flip": "card-flip 0.6s ease-out forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "float-in": "float-in 0.5s ease-out forwards",
      },
    },
  },
  plugins: [],
};
