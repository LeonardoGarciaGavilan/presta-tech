// src/common/decorators/current-user.decorator.ts
import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

/**
 * Decorador @CurrentUser() - Extrae el usuario actual desde req.user
 * 
 * Uso en controllers:
 *   create(@Body() dto, @CurrentUser() user: { userId, empresaId, rol }) {
 *     return this.service.create(dto, user.userId);
 *   }
 * 
 * Retorna el objeto user completo del token JWT
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);