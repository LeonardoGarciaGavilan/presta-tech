// roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { user } = context.switchToHttp().getRequest();

    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException('Acceso no autorizado: endpoint requiere roles específicos');
    }

    if (!user?.rol) {
      throw new ForbiddenException('Usuario sin rol definido');
    }

    const hasRole = requiredRoles.includes(user.rol);

    if (!hasRole) {
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }

    return true;
  }
}