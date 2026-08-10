// src/common/guards/permisos.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISOS_KEY } from '../permisos/permisos.decorator';
import { PermisosService } from '../permisos/permisos.service';
import { PERMISO_TODOS } from '../permisos/permisos.constants';

/**
 * Verifica permisos efectivos (@RequierePermiso) DESPUÉS de JwtAuthGuard
 * (que pobla req.user). Sin @RequierePermiso → permite (no restringe).
 * SUPERADMIN hace bypass (sus endpoints de negocio se bloquean aparte).
 */
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisosService: PermisosService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requeridos = this.reflector.getAllAndOverride<string[]>(
      PERMISOS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requeridos || requeridos.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.userId) {
      throw new ForbiddenException('Usuario no identificado');
    }
    if (user.rol === 'SUPERADMIN') return true;

    const efectivos = await this.permisosService.permisosEfectivos(user.userId);
    const tieneTodo = efectivos.includes(PERMISO_TODOS);
    const cumple = requeridos.every((p) => efectivos.includes(p));

    if (!tieneTodo && !cumple) {
      throw new ForbiddenException({
        message:
          'Acceso restringido. No tienes permisos para realizar esta acción. Contacta al administrador de tu empresa.',
        code: 'PERMISO_DENEGADO',
      });
    }
    return true;
  }
}
