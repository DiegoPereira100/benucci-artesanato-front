<<<<<<< HEAD
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
=======
 module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module:react-native-dotenv",
        {
          moduleName: "@env",
          path: ".env",
>>>>>>> 67ef7ae (Adicionando o webhook test)
          safe: false,
          allowUndefined: true,
        },
      ],
<<<<<<< HEAD
      ['@babel/plugin-transform-private-methods', { loose: true }],
      '@babel/plugin-transform-export-namespace-from',
      'react-native-reanimated/plugin',
=======
>>>>>>> 67ef7ae (Adicionando o webhook test)
    ],
  };
};
