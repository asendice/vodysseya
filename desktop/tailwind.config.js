/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './*.html'],
  theme: {
    extend: {
      colors: {
        'deep-blue': '#1a237e',
        'gray-dark': '#23272a',
        lavender: '#b57edc',
        // Add other custom colors as needed
      },
    },
  },
  plugins: [require('tailwind-scrollbar')],
};
