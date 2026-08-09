// src/common/tenant/tenant.module.ts
import { Global, Module } from '@nestjs/common';
import { TenantContext } from './tenant-context';
import { TenantInterceptor } from './tenant.interceptor';

@Global()
@Module({
  providers: [TenantContext, TenantInterceptor],
  exports: [TenantContext],
})
export class TenantModule {}
