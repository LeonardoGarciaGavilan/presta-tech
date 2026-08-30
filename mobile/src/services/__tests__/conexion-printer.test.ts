import { conectarImpresora, imprimirPrueba } from '@/services/printer.service';
import driverModule from 'react-native-thermal-printer-driver';

jest.mock('react-native-thermal-printer-driver', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    printRaw: jest.fn(),
  },
}));

const driver = driverModule as unknown as {
  connect: jest.Mock;
  disconnect: jest.Mock;
  printRaw: jest.Mock;
};

function errorConexion(): Error {
  const e = new Error('Connection failed');
  (e as { code?: string }).code = 'CONNECTION_FAILED';
  return e;
}

describe('conectarImpresora', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('conecta por bt: cuando el primer intento funciona', async () => {
    driver.connect.mockResolvedValueOnce(undefined);

    const target = await conectarImpresora('86:67:7A:C9:78:49');

    expect(driver.connect).toHaveBeenCalledTimes(1);
    expect(driver.connect).toHaveBeenCalledWith('bt:86:67:7A:C9:78:49', { timeout: 10000 });
    expect(target).toBe('bt:86:67:7A:C9:78:49');
  });

  it('reintenta por ble: cuando bt: falla con CONNECTION_FAILED', async () => {
    driver.connect.mockRejectedValueOnce(errorConexion()).mockResolvedValueOnce(undefined);

    const target = await conectarImpresora('bt:86:67:7A:C9:78:49');

    expect(driver.connect).toHaveBeenNthCalledWith(1, 'bt:86:67:7A:C9:78:49', { timeout: 10000 });
    expect(driver.connect).toHaveBeenNthCalledWith(2, 'ble:86:67:7A:C9:78:49', { timeout: 10000 });
    expect(target).toBe('ble:86:67:7A:C9:78:49');
  });

  it('no reintenta por BLE cuando el error no es de conexión', async () => {
    const e = new Error('Falta permiso');
    (e as { code?: string }).code = 'BT_PERMISSION';
    driver.connect.mockRejectedValueOnce(e);

    await expect(conectarImpresora('86:67:7A:C9:78:49')).rejects.toThrow('Falta permiso');
    expect(driver.connect).toHaveBeenCalledTimes(1);
  });

  it('propaga el error original si el reintento BLE también falla', async () => {
    driver.connect
      .mockRejectedValueOnce(errorConexion())
      .mockRejectedValueOnce(errorConexion());

    await expect(conectarImpresora('86:67:7A:C9:78:49')).rejects.toThrow();
    expect(driver.connect).toHaveBeenCalledTimes(2);
  });

  it('no reinienta si la dirección ya es ble:', async () => {
    driver.connect.mockRejectedValueOnce(errorConexion());

    await expect(conectarImpresora('ble:86:67:7A:C9:78:49')).rejects.toThrow();
    expect(driver.connect).toHaveBeenCalledTimes(1);
  });
});

describe('imprimirPrueba', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    driver.disconnect.mockResolvedValue(undefined);
  });

  it('imprime usando el transporte efectivo (ble:) cuando hubo respaldo', async () => {
    driver.connect.mockRejectedValueOnce(errorConexion()).mockResolvedValueOnce(undefined);
    driver.printRaw.mockResolvedValueOnce({ success: true, bytesWritten: 42 });

    const result = await imprimirPrueba('86:67:7A:C9:78:49');

    expect(driver.printRaw).toHaveBeenCalledWith(
      'ble:86:67:7A:C9:78:49',
      expect.any(Array),
      expect.anything(),
    );
    expect(driver.disconnect).toHaveBeenCalledWith('ble:86:67:7A:C9:78:49');
    expect(result.success).toBe(true);
    expect(result.bytesWritten).toBe(42);
  });

  it('compila en modo ASCII por defecto (sin ESC t y sin bytes >= 0x80)', async () => {
    driver.connect.mockResolvedValueOnce(undefined);
    driver.printRaw.mockResolvedValueOnce({ success: true, bytesWritten: 0 });

    await imprimirPrueba('86:67:7A:C9:78:49');

    const bytes = driver.printRaw.mock.calls[0][1] as number[];
    const tieneEscT = bytes.some((b, i) => b === 0x1b && bytes[i + 1] === 0x74);
    expect(bytes).toContain(0x1b);
    expect(bytes).toContain(0x1c); // FS . (cancelar modo chino)
    expect(bytes).toContain(0x2e);
    expect(tieneEscT).toBe(false); // sin ESC t
    for (const byte of bytes) {
      expect(byte).toBeLessThan(0x80); // solo ASCII, nunca bytes altos
    }
  });
});