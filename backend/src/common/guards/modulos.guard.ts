// src/common/guards/modulos.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULO_KEY } from '../permisos/permisos.decorator';
import { PermisosService } from '../permisos/permisos.service';

/**
 * Verifica que el módulo (@Modulo) del controller esté habilitado para la
 * empresa del usuario. Sin @Modulo → permite. Sin empresa → permite.
 * SUPERADMIN hace bypass.
 */
@Injectable()
export class ModulosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisosService: PermisosService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const modulo = this.reflector.getAllAndOverride<string>(MODULO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!modulo) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Usuario no identificado');
    if (user.rol === 'SUPERADMIN') return true;
    if (!user.empresaId) return true;

    const habilitado = await this.permisosService.moduloHabilitado(
      user.empresaId,
      modulo,
    );
    if (!habilitado) {
      throw new ForbiddenException('Módulo no disponible para tu empresa');
    }
    return true;
  }
}
