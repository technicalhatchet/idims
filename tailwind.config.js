module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Your custom colors
      },
      fontFamily: {
        // Your custom fonts
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}