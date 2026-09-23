/*
 * Config plugin: marca BLUETOOTH_SCAN como neverForLocation para que el
 * escaneo de impresoras Bluetooth Classic funcione en Android 12+ sin
 * depender del permiso de ubicación (ACCESS_FINE_LOCATION) ni del GPS.
 * Además restringe los permisos legacy (BLUETOOTH, BLUETOOTH_ADMIN, ACCESS_FINE_LOCATION)
 * a maxSdkVersion=30 para que Android 12+ no los requiera.
 */
const { createRunOncePlugin, withAndroidManifest } = require('expo/config-plugins');

const BLUETOOTH_SCAN = 'android.permission.BLUETOOTH_SCAN';
const LEGACY_PERMS = [
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  'android.permission.ACCESS_FINE_LOCATION',
];

function withScanNoLocation(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    const perms = manifest['uses-permission'];

    const seen = new Set();

    for (const perm of perms) {
      if (!perm.$) {
        perm.$ = {};
      }
      const name = perm.$['android:name'];
      if (name === BLUETOOTH_SCAN) {
        perm.$['android:usesPermissionFlags'] = 'neverForLocation';
      }
      if (LEGACY_PERMS.includes(name)) {
        perm.$['android:maxSdkVersion'] = '30';
      }
      if (name) {
        seen.add(name);
      }
    }

    for (const legacyPerm of LEGACY_PERMS) {
      if (!seen.has(legacyPerm)) {
        perms.push({
          $: {
            'android:name': legacyPerm,
            'android:maxSdkVersion': '30',
          },
        });
      }
    }

    if (!seen.has(BLUETOOTH_SCAN)) {
      perms.push({
        $: {
          'android:name': BLUETOOTH_SCAN,
          'android:usesPermissionFlags': 'neverForLocation',
        },
      });
    }

    return androidConfig;
  });
}

module.exports = createRunOncePlugin(
  withScanNoLocation,
  'with-thermal-bt-scan-no-location',
  '1.2.0'
);