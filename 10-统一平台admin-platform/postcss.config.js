module.exports = {
  plugins: {
    '@tailwindcss/postcss': { base: require('node:path').join(__dirname, 'src') },
    autoprefixer: {},
  },
};
