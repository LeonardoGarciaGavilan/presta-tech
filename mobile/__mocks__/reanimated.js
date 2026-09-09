const { View } = require('react-native');

module.exports = {
  __esModule: true,
  default: { View },
  useSharedValue: (init) => ({ value: init }),
  useAnimatedStyle: (fn) => fn(),
  cancelAnimation: () => {},
  withTiming: (toValue) => toValue,
  withSpring: (toValue) => toValue,
  withRepeat: (animations) => animations,
  withSequence: (...animations) => animations[animations.length - 1],
};