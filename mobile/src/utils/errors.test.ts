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

  it('oculta mensajes técnicos internos con el fallback', () => {
    expect(
      humanizeError(new Error("Cannot read properties of undefined (reading 'x')"), 'Error'),
    ).toBe('Error');
    expect(
      humanizeError({ message: 'TypeError: x is not a function', statusCode: 500 }, 'Fallback'),
    ).toBe('Fallback');
    expect(humanizeError(new Error('Internal server error'), 'Fallo')).toBe('Fallo');
    expect(
      humanizeError('stack\n  at something (file.ts:1:2)', 'Fallo'),
    ).toBe('Fallo');
  });

  it('conserva mensajes de negocio del servidor', () => {
    expect(
      humanizeError({ message: 'Saldo insuficiente en caja', statusCode: 400 }, 'Error'),
    ).toBe('Saldo insuficiente en caja');
    expect(
      humanizeError(new Error('La renovación requiere conexión a internet.'), 'Error'),
    ).toBe('La renovación requiere conexión a internet.');
  });
});