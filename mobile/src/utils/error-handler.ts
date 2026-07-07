import axios from 'axios';

import type { ApiError } from '@/types/api.types';

export function handleApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const data = error.response.data;
      const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      return {
        message: (body.message as string) ?? 'Error del servidor',
        statusCode: error.response.status,
        code: body.code as string | undefined,
        minutosRestantes: body.minutosRestantes as number | undefined,
      };
    }

    if (error.code === 'ECONNABORTED') {
      return {
        message: 'La solicitud tardó demasiado. Intente nuevamente.',
        statusCode: 408,
        code: 'TIMEOUT',
      };
    }

    return {
      message: 'Error de conexión. Verifica tu internet.',
      statusCode: 0,
      code: 'NETWORK_ERROR',
    };
  }

  return {
    message: 'Error inesperado',
    statusCode: 500,
    code: 'UNKNOWN_ERROR',
  };
}
