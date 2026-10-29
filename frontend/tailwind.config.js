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
          main: '#E8731A',
          hover: '#C45F10',
          light: '#FEF3E8',
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
          active: '#E8731A',
        },
      },
      fontFamily: {
        heading: ['"Tosh A"', 'Georgia', 'serif'],
        tosh: ['"Tosh A"', 'Georgia', 'serif'],
        title: ['"Tosh A"', 'Georgia', 'serif'],
        body: ['Anona', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        anona: ['Anona', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        sans: ['Anona', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '700',
        black: '700',
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
