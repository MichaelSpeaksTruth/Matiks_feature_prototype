/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      // ── Matiks colour palette: black · white · mint (sparingly) ──
      colors: {
        black: {
          DEFAULT: "#090909",
          soft:    "#141414",
          card:    "#1c1c1c",
          hover:   "#222222",
        },
        mint: {
          DEFAULT: "#7fffd4",   // aquamarine
          dim:     "rgba(127,255,212,0.10)",
          border:  "rgba(127,255,212,0.22)",
        },
      },
      keyframes: {
        riseIn: {
          "0%":   { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        sweep: {
          "100%": { transform: "translateX(100%)" },
        },
        dotPulse: {
          "0%,100%": { opacity: "1",   transform: "scale(1)" },
          "50%":     { opacity: "0.3", transform: "scale(0.82)" },
        },
      },
      animation: {
        "rise-in":   "riseIn 0.42s cubic-bezier(0.16,1,0.3,1) forwards",
        "shimmer":   "sweep 1.7s infinite",
        "dot-pulse": "dotPulse 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
