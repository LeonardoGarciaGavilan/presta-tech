// src/common/guards/superadmin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Bloquea a SUPERADMIN en endpoints de negocio (empresas).
 * Se aplica a nivel de controller junto a JwtAuthGuard.
 * SUPERADMIN solo opera en /superadmin/*, /auth/* y /auditoria global.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (user?.rol === 'SUPERADMIN') {
      throw new ForbiddenException(
        'El Super Admin solo gestiona desde su panel web',
      );
    }
    return true;
  }
}
