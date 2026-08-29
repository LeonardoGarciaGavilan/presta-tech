/*
 * Config plugin: marca BLUETOOTH_SCAN como neverForLocation para que el
 * escaneo de impresoras Bluetooth Classic funcione en Android 12+ sin
 * depender del permiso de ubicación (ACCESS_FINE_LOCATION) ni del GPS.
 */
const { createRunOncePlugin, withAndroidManifest } = require('@expo/config-plugins');

const BLUETOOTH_SCAN = 'android.permission.BLUETOOTH_SCAN';

function withScanNoLocation(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    const perms = manifest['uses-permission'];
    if (!perms) return androidConfig;
    for (const perm of perms) {
      if (perm.$ && perm.$['android:name'] === BLUETOOTH_SCAN) {
        perm.$['android:usesPermissionFlags'] = 'neverForLocation';
      }
    }
    return androidConfig;
  });
}

module.exports = createRunOncePlugin(
  withScanNoLocation,
  'with-thermal-bt-scan-no-location',
  '1.0.0'
);