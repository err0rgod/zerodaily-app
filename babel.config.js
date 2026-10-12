module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo adds the react-native-worklets plugin for Reanimated 4 automatically.
    presets: ['babel-preset-expo'],
  };
};
