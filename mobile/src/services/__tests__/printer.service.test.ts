import { direccionConTransporte, direccionLegible, mensajeErrorImpresora } from '@/services/printer.service';

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