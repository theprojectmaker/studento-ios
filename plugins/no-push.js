/**
 * Studento sends no push notifications (bell alerts are scheduled on the phone), so drop
 * the remote-push bits the expo-notifications plugin adds: the aps-environment entitlement
 * and the remote-notification background mode. Fewer capabilities for App Review to ask about.
 * Listed FIRST in app.json's plugins: config-plugin mods run in reverse order, so the first
 * plugin's entitlement step runs last and nothing re-adds the push entitlement after it.
 */
const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

function strip(config) {
  if (config.ios?.entitlements) delete config.ios.entitlements['aps-environment'];
  if (Array.isArray(config.ios?.infoPlist?.UIBackgroundModes)) {
    config.ios.infoPlist.UIBackgroundModes = config.ios.infoPlist.UIBackgroundModes.filter((m) => m !== 'remote-notification');
  }
  return config;
}

module.exports = function withNoPush(config) {
  config = strip(config);
  config = withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
  config = withInfoPlist(config, (c) => {
    const modes = c.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      const kept = modes.filter((m) => m !== 'remote-notification');
      if (kept.length) c.modResults.UIBackgroundModes = kept;
      else delete c.modResults.UIBackgroundModes;
    }
    return c;
  });
  return config;
};
