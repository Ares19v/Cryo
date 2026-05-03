/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cryo-blue': '#00A8E8',
        'cryo-blue-dark': '#0072FF',
        'cryo-bg': '#F4F7F9',
      }
    },
  },
  plugins: [],
}
