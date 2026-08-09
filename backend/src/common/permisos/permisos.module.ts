// src/common/permisos/permisos.module.ts
import { Global, Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PermisosGuard } from '../guards/permisos.guard';
import { ModulosGuard } from '../guards/modulos.guard';
import { SuperAdminGuard } from '../guards/superadmin.guard';

@Global()
@Module({
  providers: [PermisosService, PermisosGuard, ModulosGuard, SuperAdminGuard],
  exports: [PermisosService, PermisosGuard, ModulosGuard, SuperAdminGuard],
})
export class PermisosModule {}
