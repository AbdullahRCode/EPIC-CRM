import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0a",
        paper: "#fafaf7",
        "paper-2": "#f3f2ed",
        line: "#e6e4dd",
        muted: "#6b6b66",
        good: "#1f5a32",
        warn: "#8a5a1f",
        danger: "#8a1f1f",
        vip: "#d4ad53",
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        label: "0.2em",
        "label-wide": "0.3em",
      },
    },
  },
  plugins: [],
};

export default config;
