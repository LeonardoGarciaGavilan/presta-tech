const ERROR_TECNICO = /undefined|NaN|\[object Object\]|Unexpected token|Internal server error|TypeError|ReferenceError|RangeError|SyntaxError|UNKNOWN_ERROR|Cannot read propert|\n/i;

function esMensajeTecnico(mensaje: string): boolean {
  return ERROR_TECNICO.test(mensaje);
}

export function humanizeError(error: unknown, fallback: string = 'Ocurrió un error inesperado'): string {
  let mensaje = '';

  if (error === null || error === undefined) return fallback;

  if (typeof error === 'string') {
    mensaje = error.trim();
  } else if (error instanceof Error) {
    mensaje = error.message?.trim() ?? '';
  } else if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = record.message;
    if (typeof message === 'string') {
      mensaje = message.trim();
    }
  }

  if (!mensaje || esMensajeTecnico(mensaje)) {
    return fallback;
  }

  return mensaje;
}