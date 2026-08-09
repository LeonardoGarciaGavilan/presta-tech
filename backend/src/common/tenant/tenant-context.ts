// src/common/tenant/tenant-context.ts
// Contexto de empresa por request (AsyncLocalStorage). Lo establece el
// TenantInterceptor global a partir de req.user; el middleware Prisma lo lee.
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContexto {
  /** null para SUPERADMIN o requests sin empresa. */
  empresaId: string | null;
  superAdmin: boolean;
}

@Injectable()
export class TenantContext {
  private readonly store = new AsyncLocalStorage<TenantContexto>();

  run<T>(ctx: TenantContexto | null, fn: () => T): T {
    if (!ctx) {
      return this.store.run({ empresaId: null, superAdmin: false }, fn);
    }
    return this.store.run(ctx, fn);
  }

  get(): TenantContexto | null {
    return this.store.getStore() ?? null;
  }
}
