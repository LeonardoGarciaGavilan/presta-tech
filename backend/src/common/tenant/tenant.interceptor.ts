// src/common/tenant/tenant.interceptor.ts
// Interceptor GLOBAL: establece el contexto de empresa (AsyncLocalStorage) para
// el middleware Prisma a partir de req.user. Guard JwtAuthGuard ya pobló
// req.user antes de que corran los interceptores.
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext, TenantContexto } from './tenant-context';

interface UsuarioRequest {
  empresaId?: string | null;
  rol?: string;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: UsuarioRequest }>();
    const user = request.user;

    let ctx: TenantContexto | null = null;
    if (user && (user.empresaId != null || user.rol === 'SUPERADMIN')) {
      ctx = {
        empresaId: user.empresaId ?? null,
        superAdmin: user.rol === 'SUPERADMIN',
      };
    }

    return this.tenantContext.run(ctx, () => next.handle());
  }
}
