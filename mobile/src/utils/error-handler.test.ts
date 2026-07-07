import axios from 'axios';
import { handleApiError } from '@/utils/error-handler';

describe('handleApiError', () => {
  it('returns server error message from response', () => {
    const error = new axios.AxiosError(
      undefined,
      undefined,
      undefined,
      undefined,
      {
        status: 400,
        data: { message: 'El email ya está registrado' },
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
      },
    );

    const result = handleApiError(error);
    expect(result).toEqual({
      message: 'El email ya está registrado',
      statusCode: 400,
      code: undefined,
      minutosRestantes: undefined,
    });
  });

  it('returns generic message when response has no message', () => {
    const error = new axios.AxiosError(
      undefined,
      undefined,
      undefined,
      undefined,
      {
        status: 500,
        data: null,
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as any,
      },
    );

    const result = handleApiError(error);
    expect(result.message).toBe('Error del servidor');
    expect(result.statusCode).toBe(500);
  });

  it('handles timeout error', () => {
    const error = new axios.AxiosError(
      undefined,
      'ECONNABORTED',
      undefined,
      undefined,
      undefined as any,
    );

    const result = handleApiError(error);
    expect(result).toEqual({
      message: 'La solicitud tardó demasiado. Intente nuevamente.',
      statusCode: 408,
      code: 'TIMEOUT',
    });
  });

  it('handles network error', () => {
    const error = new axios.AxiosError(
      undefined,
      'ERR_NETWORK',
      undefined,
      undefined,
      undefined as any,
    );

    const result = handleApiError(error);
    expect(result).toEqual({
      message: 'Error de conexión. Verifica tu internet.',
      statusCode: 0,
      code: 'NETWORK_ERROR',
    });
  });

  it('handles unknown non-axios error', () => {
    const error = new Error('Algo explotó');

    const result = handleApiError(error);
    expect(result).toEqual({
      message: 'Error inesperado',
      statusCode: 500,
      code: 'UNKNOWN_ERROR',
    });
  });

  it('returns server message as-is without hardcoded mapping', () => {
    const error = new axios.AxiosError(
      undefined,
      undefined,
      undefined,
      undefined,
      {
        status: 400,
        data: { message: 'numerocuota 3650 supera el límite' },
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
      },
    );

    const result = handleApiError(error);
    expect(result.message).toBe('numerocuota 3650 supera el límite');
  });

  it('preserves minutosRestantes from response', () => {
    const error = new axios.AxiosError(
      undefined,
      undefined,
      undefined,
      undefined,
      {
        status: 429,
        data: { message: 'Demasiadas solicitudes', minutosRestantes: 5 },
        statusText: 'Too Many Requests',
        headers: {},
        config: {} as any,
      },
    );

    const result = handleApiError(error);
    expect(result.minutosRestantes).toBe(5);
    expect(result.statusCode).toBe(429);
  });
});
