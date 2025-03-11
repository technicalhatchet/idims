/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./frontend/pages/**/*.{js,ts,jsx,tsx}",
    "./frontend/components/**/*.{js,ts,jsx,tsx}",
    "./frontend/context/**/*.{js,ts,jsx,tsx}",
    "./frontend/hooks/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./layouts/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}"
  ],
  safelist: [
    // Add frequently used classes that might be missed by the purge
    'bg-blue-600',
    'text-white',
    'hover:bg-blue-700',
    'dark:bg-gray-800',
    'dark:text-white',
    // Navigation classes
    'flex',
    'items-center',
    'justify-center',
    'justify-between',
    'px-4',
    'py-2',
    'rounded-md',
    'shadow',
    'font-medium',
    'space-x-4',
    'md:flex',
    'md:space-x-8',
    'md:items-center',
    // Form inputs
    'form-input',
    'form-select',
    'form-checkbox',
    'form-textarea'
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors can be added here
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      spacing: {
        // Custom spacing can be added here
      },
      borderRadius: {
        // Custom border radius can be added here
      },
      boxShadow: {
        // Custom shadows can be added here
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
  darkMode: 'class',
}