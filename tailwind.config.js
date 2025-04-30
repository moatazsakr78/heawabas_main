/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#901b15',
        'primary-dark': '#701510',
        secondary: '#10b981',
        dark: '#1f2937',
      },
    },
  },
  plugins: [],
}; 