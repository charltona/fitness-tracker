const { withGradleProperties } = require('@expo/config-plugins');

function withJavaHomeMod(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => item.key !== 'org.gradle.java.home'
    );
    config.modResults.push({
      type: 'property',
      key: 'org.gradle.java.home',
      value: 'D:\\JDK',
    });
    return config;
  });
}

module.exports = function withCustomGradle(config) {
  return withJavaHomeMod(config);
};
