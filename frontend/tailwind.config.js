/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          main: '#0047AB',
          hover: '#003380',
          light: '#E8F0FE',
        },
        accent: {
          green: '#10B981',
          red: '#DC2626',
        },
        surface: '#FFFFFF',
        bg: {
          primary: '#FFFFFF',
          secondary: '#F9FAFB',
        },
        txt: {
          primary: '#111827',
          secondary: '#4B5563',
        },
        border: '#E5E7EB',
        sidebar: {
          bg: '#FFFFFF',
          hover: '#F3F4F6',
          active: '#0047AB',
        },
      },
      fontFamily: {
        heading: ['Chivo', 'sans-serif'],
        body: ['IBM Plex Sans', 'sans-serif'],
      },
      width: {
        sidebar: '17rem',
      },
      spacing: {
        sidebar: '17rem',
      },
      borderRadius: {
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
}
