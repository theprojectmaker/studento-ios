/**
 * Alternate app icons for the MAIN app target only.
 *
 * expo-alternate-app-icons' own config plugin sets ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES
 * on every Xcode target, including the widget extension (ExpoWidgetsTarget), which has no
 * alternate icon sets; Xcode can fail that target's asset-catalog step. This wrapper reuses
 * the library's icon generator and Xcode setting, but only for the app target.
 *
 * Usage in app.json: ["./plugins/alternate-icons", ["./assets/icons/Midnight.png", ...]]
 */
const { IOSConfig, withXcodeProject } = require('expo/config-plugins');
const { withAlternateAppIconsGenerator } = require('expo-alternate-app-icons/plugin/build/ios/withAlternateAppIconsGenerator');
const { toAlternateIcon, toPascalCaseIconName } = require('expo-alternate-app-icons/plugin/build/utils');

module.exports = function withStudentoAlternateIcons(config, paths = []) {
  if (!paths.length) return config;
  const icons = paths.map(toAlternateIcon).map(toPascalCaseIconName);
  const names = icons.map((i) => i.name);

  // Copies each PNG into ios/<App>/Images.xcassets/<Name>.appiconset (iOS only).
  config = withAlternateAppIconsGenerator(config, icons);

  config = withXcodeProject(config, (cfg) => {
    const appTarget = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    cfg.modResults.updateBuildProperty('ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES', names, undefined, appTarget);
    return cfg;
  });
  return config;
};
