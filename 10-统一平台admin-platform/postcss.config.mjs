import { fileURLToPath } from 'node:url';

const config = {
  plugins: {
    "@tailwindcss/postcss": { base: fileURLToPath(new URL('./src', import.meta.url)) },
  },
};

export default config;
