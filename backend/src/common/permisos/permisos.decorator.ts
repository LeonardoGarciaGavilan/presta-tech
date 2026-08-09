// src/common/permisos/permisos.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISOS_KEY = 'permisosRequeridos';
export const MODULO_KEY = 'moduloRequerido';

// @RequierePermiso('prestamo:aprobar') — exige permiso(s) efectivo(s).
export const RequierePermiso = (...permisos: string[]) =>
  SetMetadata(PERMISOS_KEY, permisos);

// @Modulo('EMPLEADOS') — a nivel de controller: bloquea todo el módulo
// si está deshabilitado para la empresa.
export const Modulo = (modulo: string) => SetMetadata(MODULO_KEY, modulo);
