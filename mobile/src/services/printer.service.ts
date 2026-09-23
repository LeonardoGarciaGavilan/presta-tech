import { Linking, PermissionsAndroid, Platform } from 'react-native';
import type { Device, Node, PrintResult, ScanResult } from 'react-native-thermal-printer-driver';

import { buildDocumentoPrueba } from '@/utils/recibo-test';
import { compilarDocumento } from '@/utils/escpos-compiler';
import type { CodigoSalida } from '@/utils/escpos-code-pages';

type Driver = typeof import('react-native-thermal-printer-driver').default;

const CONNECT_TIMEOUT_MS = 10000;

export const CODIGO_PAGINA_DEFECTO: CodigoSalida = 'ascii';

const TRANSPORT_PREFIX_RE = /^(bt|ble|lan):/i;

export function direccionConTransporte(address: string, deviceType?: Device['deviceType']): string {
  if (TRANSPORT_PREFIX_RE.test(address)) return address;
  if (deviceType === 'ble') return `ble:${address}`;
  return `bt:${address}`;
}

export function direccionLegible(address: string): string {
  return address.replace(TRANSPORT_PREFIX_RE, '');
}

let cachedDriver: Driver | null | undefined;

export const MENSAJE_NO_DISPONIBLE =
  'La impresión térmica no está disponible en Expo Go: necesita una compilación nativa. Compila con `npx expo run:android` o crea un dev build con EAS.';

async function getDriver(): Promise<Driver> {
  if (cachedDriver === undefined) {
    try {
      const mod = require('react-native-thermal-printer-driver');
      cachedDriver = mod?.default ?? mod ?? null;
    } catch {
      cachedDriver = null;
    }
  }
  if (!cachedDriver) {
    throw new Error(MENSAJE_NO_DISPONIBLE);
  }
  return cachedDriver;
}

export async function isThermalPrinterDisponible(): Promise<boolean> {
  try {
    await getDriver();
    return true;
  } catch {
    return false;
  }
}

export type EstadoPermisoBluetooth =
  | 'concedido'
  | 'denegado'
  | 'denegado-permanente'
  | 'no-requerido';

export async function asegurarPermisoBluetooth(): Promise<EstadoPermisoBluetooth> {
  if (Platform.OS !== 'android') return 'no-requerido';

  const isAndroid12Plus = Number(Platform.Version) >= 31;

  if (isAndroid12Plus) {
    const scanGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
    const connectGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    if (scanGranted && connectGranted) return 'concedido';

    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);

    const allGranted = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ].every((p) => granted[p] === PermissionsAndroid.RESULTS.GRANTED);

    if (allGranted) return 'concedido';

    const showRationale =
      PermissionsAndroid.shouldShowRequestPermissionRationale(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN) ||
      PermissionsAndroid.shouldShowRequestPermissionRationale(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);

    return showRationale ? 'denegado' : 'denegado-permanente';
  }

  const locationGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  if (locationGranted) return 'concedido';

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );

  if (granted === PermissionsAndroid.RESULTS.GRANTED) return 'concedido';

  const showRationale = PermissionsAndroid.shouldShowRequestPermissionRationale(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return showRationale ? 'denegado' : 'denegado-permanente';
}

export async function requestBluetoothPermission(): Promise<boolean> {
  const estado = await asegurarPermisoBluetooth();
  return estado === 'concedido';
}

export async function abrirAjustesApp(): Promise<void> {
  if (Platform.OS === 'android') {
    await Linking.openSettings();
  }
}

export async function escanearImpresoras(): Promise<ScanResult> {
  const driver = await getDriver();
  return driver.scan();
}

export async function conectarImpresora(address: string): Promise<string> {
  const driver = await getDriver();
  const target = direccionConTransporte(address);
  try {
    await driver.connect(target, { timeout: CONNECT_TIMEOUT_MS });
    return target;
  } catch (error) {
    if (esErrorConexion(error) && target.startsWith('bt:')) {
      const fallback = `ble:${direccionLegible(target)}`;
      await driver.connect(fallback, { timeout: CONNECT_TIMEOUT_MS }).catch(() => {
        throw error;
      });
      return fallback;
    }
    throw error;
  }
}

export async function desconectarImpresora(address: string): Promise<void> {
  const driver = await getDriver();
  await driver.disconnect(direccionConTransporte(address));
}

export async function imprimirPrueba(
  address: string,
  codePage?: CodigoSalida,
): Promise<PrintResult> {
  const driver = await getDriver();
  const target = await conectarImpresora(address);
  try {
    const bytes = compilarDocumento(buildDocumentoPrueba(), {
      paperWidthMm: 58,
      codePage: codePage ?? CODIGO_PAGINA_DEFECTO,
    });
    return await driver.printRaw(target, bytes, {
      keepAlive: false,
      timeout: CONNECT_TIMEOUT_MS,
    });
  } finally {
    await driver.disconnect(target).catch(() => undefined);
  }
}

export async function imprimirDocumento(
  address: string,
  nodes: Node[],
  codePage?: CodigoSalida,
): Promise<PrintResult> {
  const driver = await getDriver();
  const target = await conectarImpresora(address);
  try {
    const bytes = compilarDocumento(nodes, {
      paperWidthMm: 58,
      codePage: codePage ?? CODIGO_PAGINA_DEFECTO,
    });
    return await driver.printRaw(target, bytes, {
      keepAlive: false,
      timeout: CONNECT_TIMEOUT_MS,
    });
  } finally {
    await driver.disconnect(target).catch(() => undefined);
  }
}

function esErrorConexion(error: unknown): boolean {
  return (error as { code?: string })?.code === 'CONNECTION_FAILED';
}

const MENSAJES_ERROR: Record<string, string> = {
  CONNECTION_FAILED:
    'No se pudo conectar con la impresora. Verifica que esté encendida, cerca del celular y que no la esté usando otra app.',
  SCAN_FAILED:
    'No se pudo escanear. Verifica el permiso de ubicación (y que la ubicación esté activada) y que el Bluetooth esté encendido.',
  BT_PERMISSION: 'Falta el permiso Bluetooth. Concédelo e inténtalo de nuevo.',
  BT_DISABLED: 'El Bluetooth está apagado. Actívalo e inténtalo de nuevo.',
};

export function mensajeErrorImpresora(error: unknown): string {
  const err = error as {
    code?: string;
    message?: string;
    suggestion?: string;
  };
  const code = err?.code;
  const message = err?.message ?? 'Error desconocido';
  const suggestion = err?.suggestion ? `\n${err.suggestion}` : '';
  if (code && MENSAJES_ERROR[code]) {
    return `${MENSAJES_ERROR[code]} [${code}]`;
  }
  return `${message}${code ? ` [${code}]` : ''}${suggestion}`;
}