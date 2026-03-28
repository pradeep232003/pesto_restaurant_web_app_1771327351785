/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--color-border)", /* dark brown with opacity */
        input: "var(--color-input)", /* white */
        ring: "var(--color-ring)", /* deep burnt-orange */
        background: "var(--color-background)", /* warm off-white */
        foreground: "var(--color-foreground)", /* dark brown */
        primary: {
          DEFAULT: "var(--color-primary)", /* deep burnt-orange */
          foreground: "var(--color-primary-foreground)", /* white */
        },
        secondary: {
          DEFAULT: "var(--color-secondary)", /* rich dark brown */
          foreground: "var(--color-secondary-foreground)", /* white */
        },
        destructive: {
          DEFAULT: "var(--color-destructive)", /* dark red */
          foreground: "var(--color-destructive-foreground)", /* white */
        },
        muted: {
          DEFAULT: "var(--color-muted)", /* warm off-white */
          foreground: "var(--color-muted-foreground)", /* lighter brown */
        },
        accent: {
          DEFAULT: "var(--color-accent)", /* mustard yellow */
          foreground: "var(--color-accent-foreground)", /* dark brown */
        },
        popover: {
          DEFAULT: "var(--color-popover)", /* white */
          foreground: "var(--color-popover-foreground)", /* dark brown */
        },
        card: {
          DEFAULT: "var(--color-card)", /* white */
          foreground: "var(--color-card-foreground)", /* dark brown */
        },
        success: {
          DEFAULT: "var(--color-success)", /* deep forest green */
          foreground: "var(--color-success-foreground)", /* white */
        },
        warning: {
          DEFAULT: "var(--color-warning)", /* dark goldenrod */
          foreground: "var(--color-warning-foreground)", /* white */
        },
        error: {
          DEFAULT: "var(--color-error)", /* dark red */
          foreground: "var(--color-error-foreground)", /* white */
        },
      },
      fontFamily: {
        'heading': ['Poppins', 'sans-serif'],
        'body': ['Inter', 'sans-serif'],
        'caption': ['DM Sans', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out-right": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-out-right": "slide-out-right 0.3s ease-out",
      },
      boxShadow: {
        'warm-sm': '0 1px 2px 0 rgba(76, 29, 10, 0.1)',
        'warm': '0 4px 6px -1px rgba(76, 29, 10, 0.1), 0 2px 4px -1px rgba(76, 29, 10, 0.06)',
        'warm-lg': '0 10px 15px -3px rgba(76, 29, 10, 0.1), 0 4px 6px -2px rgba(76, 29, 10, 0.05)',
        'warm-xl': '0 20px 25px -5px rgba(76, 29, 10, 0.1), 0 10px 10px -5px rgba(76, 29, 10, 0.04)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
}