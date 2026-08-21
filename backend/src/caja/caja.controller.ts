// src/caja/caja.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CajaService } from './caja.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { PermisosGuard } from '../common/guards/permisos.guard';
import { ModulosGuard } from '../common/guards/modulos.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { Modulo, RequierePermiso } from '../common/permisos/permisos.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { getFechaRD } from '../common/utils/fecha.utils';

@Controller('caja')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
  ModulosGuard,
  PermisosGuard,
  SuperAdminGuard,
)
@Modulo('CAJA')
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  // GET /caja/resumen?fecha=2026-02-26&cajaId=xxx
  @Get('resumen')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('caja:ver')
  getResumen(
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Query('fecha') fecha: string,
    @Query('cajaId') cajaId?: string,
  ) {
    const fechaConsulta = fecha ?? getFechaRD();
    const isAdmin = user.rol === 'ADMIN';
    return this.cajaService.getResumenDia(
      empresaId,
      fechaConsulta,
      cajaId,
      user.userId,
      isAdmin,
    );
  }

  // GET /caja/activa?fecha=2026-02-26
  @Get('activa')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('caja:ver')
  miCajaActiva(
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Query('fecha') fecha: string,
  ) {
    const fechaConsulta = fecha ?? getFechaRD();
    return this.cajaService.miCajaActiva(empresaId, user.userId, fechaConsulta);
  }

  // GET /caja/historial
  @Get('historial')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('caja:ver')
  historial(@Tenant() empresaId: string, @CurrentUser() user: any) {
    const isAdmin = user.rol === 'ADMIN';
    return this.cajaService.historialCajas(empresaId, user.userId, isAdmin);
  }

  // POST /caja/abrir
  @Post('abrir')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('caja:abrir')
  @Idempotent()
  abrir(
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Body() body: { montoInicial: number; fecha?: string },
  ) {
    const fecha = body.fecha ?? getFechaRD();
    return this.cajaService.abrirCaja(
      empresaId,
      user.userId,
      body.montoInicial,
      fecha,
    );
  }

  // PATCH /caja/:id/cerrar (delegates to cerrarCajaSimple)
  @Patch(':id/cerrar')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('caja:ajuste')
  @Idempotent()
  cerrar(
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { montoCierre: number; observaciones?: string },
  ) {
    const isAdmin = user.rol === 'ADMIN';
    return this.cajaService.cerrarCaja(
      id,
      empresaId,
      user.userId,
      body.montoCierre,
      body.observaciones,
      isAdmin,
    );
  }

  // POST /caja/cerrar (simplificado - cierra la caja abierta actual)
  @Post('cerrar')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('caja:cerrar')
  @Idempotent()
  cerrarCajaSimple(
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Body() body: { montoCierre: number; observaciones?: string },
  ) {
    const isAdmin = user.rol === 'ADMIN';
    return this.cajaService.cerrarCajaSimple(
      empresaId,
      user.userId,
      body.montoCierre,
      body.observaciones,
      undefined,
      isAdmin,
    );
  }

  // GET /caja?estado=ABIERTA
  @Get()
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('caja:ver')
  getCajas(
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Query('estado') estado?: string,
  ) {
    const isAdmin = user.rol === 'ADMIN';
    return this.cajaService.getCajas(empresaId, estado, user.userId, isAdmin);
  }

  // GET /caja/:id/auditoria
  @Get(':id/auditoria')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('caja:ver')
  getAuditoria(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    const isAdmin = user.rol === 'ADMIN';
    return this.cajaService.getAuditoria(id, empresaId, user.userId, isAdmin);
  }
}
