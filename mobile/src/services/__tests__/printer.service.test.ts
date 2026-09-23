import { direccionConTransporte, direccionLegible, mensajeErrorImpresora } from '@/services/printer.service';

jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: '33' },
  PermissionsAndroid: {
    PERMISSIONS: {
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
    check: jest.fn(),
    requestMultiple: jest.fn(),
    request: jest.fn(),
    shouldShowRequestPermissionRationale: jest.fn(),
  },
  Linking: { openSettings: jest.fn() },
}));

import { Platform, PermissionsAndroid, Linking } from 'react-native';
import {
  asegurarPermisoBluetooth,
  requestBluetoothPermission,
  abrirAjustesApp,
} from '@/services/printer.service';

describe('direccionConTransporte', () => {
  it('antepone bt: a una MAC cruda', () => {
    expect(direccionConTransporte('86:67:7A:C9:78:49')).toBe('bt:86:67:7A:C9:78:49');
  });

  it('mantiene el esquema si ya viene prefijado', () => {
    expect(direccionConTransporte('bt:86:67:7A:C9:78:49')).toBe('bt:86:67:7A:C9:78:49');
    expect(direccionConTransporte('ble:86:67:7A:C9:78:49')).toBe('ble:86:67:7A:C9:78:49');
  });

  it('usa ble: solo para dispositivos BLE puros', () => {
    expect(direccionConTransporte('86:67:7A:C9:78:49', 'ble')).toBe('ble:86:67:7A:C9:78:49');
    expect(direccionConTransporte('86:67:7A:C9:78:49', 'dual')).toBe('bt:86:67:7A:C9:78:49');
    expect(direccionConTransporte('86:67:7A:C9:78:49', 'bt')).toBe('bt:86:67:7A:C9:78:49');
  });
});

describe('direccionLegible', () => {
  it('quita el prefijo de transporte', () => {
    expect(direccionLegible('bt:86:67:7A:C9:78:49')).toBe('86:67:7A:C9:78:49');
    expect(direccionLegible('86:67:7A:C9:78:49')).toBe('86:67:7A:C9:78:49');
  });
});

describe('mensajeErrorImpresora', () => {
  it('traduce códigos conocidos a un mensaje accionable', () => {
    const msg = mensajeErrorImpresora({ code: 'CONNECTION_FAILED', message: 'Connection failed', retryable: true, suggestion: 'x' });
    expect(msg).toContain('No se pudo conectar');
    expect(msg).toContain('CONNECTION_FAILED');
  });

  it('conserva el mensaje para errores desconocidos', () => {
    const msg = mensajeErrorImpresora({ message: 'Algo raro', code: 'XYZ' });
    expect(msg).toBe('Algo raro [XYZ]');
  });
});

describe('asegurarPermisoBluetooth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform.Version as unknown) = '33';
    (Platform.OS as unknown) = 'android';
  });

  it('devuelve no-requerido en iOS', async () => {
    (Platform.OS as unknown) = 'ios';
    const estado = await asegurarPermisoBluetooth();
    expect(estado).toBe('no-requerido');
  });

  it('devuelve concedido si ambos permisos ya están otorgados (Android 12+)', async () => {
    (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);
    const estado = await asegurarPermisoBluetooth();
    expect(estado).toBe('concedido');
  });

  it('pide permisos y devuelve concedido si el usuario acepta (Android 12+)', async () => {
    (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
      'android.permission.BLUETOOTH_SCAN': PermissionsAndroid.RESULTS.GRANTED,
      'android.permission.BLUETOOTH_CONNECT': PermissionsAndroid.RESULTS.GRANTED,
    });
    const estado = await asegurarPermisoBluetooth();
    expect(estado).toBe('concedido');
    expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith([
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
    ]);
  });

  it('devuelve denegado si el usuario niega pero puede volver a pedir (Android 12+)', async () => {
    (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
      'android.permission.BLUETOOTH_SCAN': PermissionsAndroid.RESULTS.DENIED,
      'android.permission.BLUETOOTH_CONNECT': PermissionsAndroid.RESULTS.DENIED,
    });
    (PermissionsAndroid.shouldShowRequestPermissionRationale as jest.Mock).mockReturnValue(true);
    const estado = await asegurarPermisoBluetooth();
    expect(estado).toBe('denegado');
  });

  it('devuelve denegado-permanente si el usuario marcó "no volver a preguntar" (Android 12+)', async () => {
    (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
      'android.permission.BLUETOOTH_SCAN': PermissionsAndroid.RESULTS.DENIED,
      'android.permission.BLUETOOTH_CONNECT': PermissionsAndroid.RESULTS.DENIED,
    });
    (PermissionsAndroid.shouldShowRequestPermissionRationale as jest.Mock).mockReturnValue(false);
    const estado = await asegurarPermisoBluetooth();
    expect(estado).toBe('denegado-permanente');
  });

  it('usa ACCESS_FINE_LOCATION en Android < 12', async () => {
    (Platform.Version as unknown) = '30';
    (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
    (PermissionsAndroid.request as jest.Mock).mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    const estado = await asegurarPermisoBluetooth();
    expect(estado).toBe('concedido');
    expect(PermissionsAndroid.request).toHaveBeenCalledWith('android.permission.ACCESS_FINE_LOCATION');
  });
});

describe('requestBluetoothPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform.Version as unknown) = '33';
    (Platform.OS as unknown) = 'android';
  });

  it('delega en asegurarPermisoBluetooth y devuelve true si concedido', async () => {
    (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);
    const result = await requestBluetoothPermission();
    expect(result).toBe(true);
  });

  it('devuelve false si asegurarPermisoBluetooth no devuelve concedido', async () => {
    (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
      'android.permission.BLUETOOTH_SCAN': PermissionsAndroid.RESULTS.DENIED,
      'android.permission.BLUETOOTH_CONNECT': PermissionsAndroid.RESULTS.DENIED,
    });
    (PermissionsAndroid.shouldShowRequestPermissionRationale as jest.Mock).mockReturnValue(false);
    const result = await requestBluetoothPermission();
    expect(result).toBe(false);
  });
});

describe('abrirAjustesApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('llama a Linking.openSettings en Android', async () => {
    (Platform.OS as unknown) = 'android';
    await abrirAjustesApp();
    expect(Linking.openSettings).toHaveBeenCalled();
  });

  it('no hace nada en iOS', async () => {
    (Platform.OS as unknown) = 'ios';
    await abrirAjustesApp();
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });
});