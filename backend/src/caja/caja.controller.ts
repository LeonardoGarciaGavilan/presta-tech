// src/caja/caja.controller.ts
import {
  Controller, Get, Post, Patch,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { CajaService } from './caja.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { getFechaRD } from '../common/utils/fecha.utils';

@Controller('caja')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  // GET /caja/resumen?fecha=2026-02-26
  @Get('resumen')
  @Roles('ADMIN', 'EMPLEADO')
  getResumen(@Tenant() empresaId: string, @Query('fecha') fecha: string) {
    const fechaConsulta = fecha ?? getFechaRD();
    return this.cajaService.getResumenDia(empresaId, fechaConsulta);
  }

  // GET /caja/activa?fecha=2026-02-26
  @Get('activa')
  @Roles('ADMIN', 'EMPLEADO')
  miCajaActiva(@Tenant() empresaId: string, @CurrentUser() user: any, @Query('fecha') fecha: string) {
    const fechaConsulta = fecha ?? getFechaRD();
    return this.cajaService.miCajaActiva(
      empresaId,
      user.userId,
      fechaConsulta,
    );
  }

  // GET /caja/historial
  @Get('historial')
  @Roles('ADMIN', 'EMPLEADO')
  historial(@Tenant() empresaId: string, @CurrentUser() user: any) {
    const isAdmin = user.rol === 'ADMIN';
    return this.cajaService.historialCajas(
      empresaId,
      user.userId,
      isAdmin,
    );
  }

  // POST /caja/abrir
  @Post('abrir')
  @Roles('ADMIN', 'EMPLEADO')
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
  cerrar(
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { montoCierre: number; observaciones?: string },
  ) {
    return this.cajaService.cerrarCaja(
      id,
      empresaId,
      user.userId,
      body.montoCierre,
      body.observaciones,
    );
  }

   // POST /caja/cerrar (simplificado - cierra la caja abierta actual)
   @Post('cerrar')
   @Roles('ADMIN', 'EMPLEADO')
   cerrarCajaSimple(
     @Tenant() empresaId: string,
     @CurrentUser() user: any,
     @Body() body: { montoCierre: number; observaciones?: string },
   ) {
     return this.cajaService.cerrarCajaSimple(
       empresaId,
       user.userId,
       body.montoCierre,
       body.observaciones,
     );
   }

   // GET /caja?estado=ABIERTA
   @Get()
   @Roles('ADMIN', 'EMPLEADO')
   getCajas(@Tenant() empresaId: string, @Query('estado') estado?: string) {
     return this.cajaService.getCajas(empresaId, estado);
   }

   // GET /caja/:id/auditoria
   @Get(':id/auditoria')
   @Roles('ADMIN', 'EMPLEADO')
   getAuditoria(@Param('id') id: string, @Tenant() empresaId: string) {
     return this.cajaService.getAuditoria(id, empresaId);
   }
 }