import { humanizeError } from '@/utils/errors';

describe('humanizeError', () => {
  it('devuelve el fallback para null/undefined', () => {
    expect(humanizeError(null)).toBe('Ocurrió un error inesperado');
    expect(humanizeError(undefined, 'Error al cerrar caja')).toBe('Error al cerrar caja');
  });

  it('devuelve strings tal cual', () => {
    expect(humanizeError('Error de conexión')).toBe('Error de conexión');
  });

  it('devuelve el fallback para strings vacíos', () => {
    expect(humanizeError('   ', 'Fallo')).toBe('Fallo');
  });

  it('extrae message de instancias de Error', () => {
    expect(humanizeError(new Error('Saldo insuficiente'))).toBe('Saldo insuficiente');
    expect(humanizeError(new Error(''))).toBe('Ocurrió un error inesperado');
  });

  it('extrae message de objetos tipo ApiError', () => {
    expect(
      humanizeError({ message: 'Caja no encontrada', statusCode: 404, code: 'CAJA_NOT_FOUND' }),
    ).toBe('Caja no encontrada');
  });

  it('devuelve el fallback para objetos sin message', () => {
    expect(humanizeError({ code: 'NETWORK_ERROR' })).toBe('Ocurrió un error inesperado');
  });

  it('devuelve el fallback para tipos no manejados', () => {
    expect(humanizeError(42)).toBe('Ocurrió un error inesperado');
    expect(humanizeError(true)).toBe('Ocurrió un error inesperado');
  });
});