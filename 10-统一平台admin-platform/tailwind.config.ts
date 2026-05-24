import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 品牌色系
        brand: {
          gold: '#C8A96E',
          'gold-light': '#E8D5A0',
          'gold-dark': '#A8894E',
          red: '#8B1A1A',
          'red-light': '#B84A4A',
          'red-dark': '#5A1010',
        },
        // 辅助色
        primary: {
          50: '#fdf4e6',
          100: '#fae8c9',
          200: '#f5d194',
          300: '#efba5f',
          400: '#e8a32a',
          500: '#C8A96E',
          600: '#a8894e',
          700: '#88693e',
          800: '#68502e',
          900: '#48381e',
        },
        accent: {
          50: '#fce8e8',
          100: '#f9d1d1',
          200: '#f3a3a3',
          300: '#ed7575',
          400: '#e74747',
          500: '#8B1A1A',
          600: '#741515',
          700: '#5d1010',
          800: '#460c0c',
          900: '#2f0808',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
