// src/common/decorators/tenant.decorator.ts
import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Decorador @Tenant() - Extrae el empresaId desde req.user.empresaId
 * 
 * Uso en controllers:
 *   create(@Body() dto, @Tenant() empresaId: string) {
 *     return this.service.create(dto, empresaId);
 *   }
 * 
 * Comportamiento:
 * - Extrae empresaId desde req.user.empresaId
 * - Si NO es SUPERADMIN y empresaId es null, lanza UnauthorizedException
 * - Si es SUPERADMIN, permite null (puede gestionar todas las empresas)
 * - Retorna el empresaId como string (puede ser null para SUPERADMIN)
 */
export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    const empresaId = user?.empresaId;
    const isSuperAdmin = user?.rol === 'SUPERADMIN';

    // SUPERADMIN puede tener empresaId null
    if (isSuperAdmin) {
      return empresaId ?? null;
    }

    // Usuarios normales deben tener empresaId
    if (!empresaId) {
      throw new UnauthorizedException(
        'Empresa no identificada en el token. Contacte al administrador.',
      );
    }

    return empresaId;
  },
);