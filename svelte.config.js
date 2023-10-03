const preprocess = require("svelte-preprocess");

// module.exports = {
//   preprocess: preprocess(),
// };

const config = {
  preprocess: preprocess({
    scss: {
      prependData: `@import './src/scss/main.scss';`,
    },
  }),
};

export default config;
