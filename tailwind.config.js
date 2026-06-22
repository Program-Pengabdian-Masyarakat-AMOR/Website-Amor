/** @type {import('tailwindcss').Config} */
// Token di-port PERSIS dari prototype (lihat docs/CLAUDE.md → Design System).
// Jangan kira-kira nilai baru.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        krem: '#F7F4EF',
        permukaan: '#FCFAF6',
        'permukaan-2': '#F2EDE4',
        tinta: {
          DEFAULT: '#1C1B19',
          60: '#5C5852',
          40: '#8A857C',
        },
        border: {
          DEFAULT: '#E6E0D6',
          kuat: '#D8D1C4',
        },
        amber: {
          DEFAULT: '#D9641E',
          teks: '#BC5618',
          tombol: '#A8501A',
          lembut: '#F6E7DA',
        },
        olive: {
          DEFAULT: '#3A4D39',
          lembut: '#E7ECE3',
        },
        normal: {
          DEFAULT: '#4F7A4A',
          teks: '#3C6038',
          bg: '#E9F0E5',
        },
        warning: {
          DEFAULT: '#C98A1E',
          teks: '#8A5D11',
          bg: '#F8EDD6',
        },
        critical: {
          DEFAULT: '#B23A30',
          teks: '#9A3127',
          bg: '#F6E2DE',
        },
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
      },
      boxShadow: {
        1: '0 1px 2px rgba(28,27,25,.05),0 1px 3px rgba(28,27,25,.04)',
        2: '0 1px 2px rgba(28,27,25,.05),0 12px 30px -16px rgba(28,27,25,.2)',
      },
      fontFamily: {
        heading: ['Fraunces', 'serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
