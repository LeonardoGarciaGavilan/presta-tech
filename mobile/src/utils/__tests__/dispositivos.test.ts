import type { ScanResult } from 'react-native-thermal-printer-driver';

import { fusionarListas, nombreLegible } from '@/utils/dispositivos';

describe('fusionarListas', () => {
  const impresora = { name: 'PT-210_7849', address: '86:67:7A:C9:78:49', deviceType: 'dual' } as const;
  const bocina = { name: 'Sonido XYZ', address: 'AA:BB:CC:DD:EE:FF', deviceType: 'bt' } as const;

  it('conserva todas las vinculadas aunque no estén en el escaneo', () => {
    const result: ScanResult = {
      paired: [impresora],
      found: [{ name: 'Unknown Device', address: '11:22:33:44:55:66', deviceType: 'bt' }],
    };
    const { vinculadas, detectadas } = fusionarListas(result);
    expect(vinculadas).toHaveLength(1);
    expect(vinculadas[0].address).toBe(impresora.address);
    expect(detectadas.map((d) => d.address)).toEqual(['11:22:33:44:55:66']);
  });

  it('no duplica un dispositivo que aparece vinculado y en el escaneo', () => {
    const result: ScanResult = {
      paired: [impresora],
      found: [{ ...impresora, rssi: -55 }],
    };
    const { vinculadas, detectadas } = fusionarListas(result);
    expect(vinculadas).toHaveLength(1);
    expect(detectadas).toHaveLength(0);
  });

  it('separa vinculadas de detectadas', () => {
    const result: ScanResult = {
      paired: [impresora, bocina],
      found: [{ name: 'Sensor', address: '77:88:99:00:11:22', deviceType: 'ble' }],
    };
    const { vinculadas, detectadas } = fusionarListas(result);
    expect(vinculadas.map((d) => d.name)).toEqual(['PT-210_7849', 'Sonido XYZ']);
    expect(detectadas[0].name).toBe('Sensor');
  });

  it('limpia el nombre "Unknown Device" para mostrar (sin nombre)', () => {
    const result: ScanResult = {
      paired: [{ name: 'Unknown Device', address: 'A', deviceType: 'dual' }],
      found: [{ name: '', address: 'B', deviceType: 'ble' }],
    };
    const { vinculadas, detectadas } = fusionarListas(result);
    expect(vinculadas[0].name).toBe('');
    expect(detectadas[0].name).toBe('');
  });

  it('nombreLegible devuelve el nombre real y vacío para desconocidos', () => {
    expect(nombreLegible('Unknown Device')).toBe('');
    expect(nombreLegible(' PT-210_7849 ')).toBe('PT-210_7849');
  });
});