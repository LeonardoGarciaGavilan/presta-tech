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

// ─── Fecha local (fix UTC-4 República Dominicana) ─────────────────────────────
function fechaLocalHoy(): string {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

@Controller('caja')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  // GET /caja/resumen?fecha=2026-02-26
  @Get('resumen')
  @Roles('ADMIN', 'EMPLEADO')
  getResumen(@Tenant() empresaId: string, @Query('fecha') fecha: string) {
    const fechaConsulta = fecha ?? fechaLocalHoy();
    return this.cajaService.getResumenDia(empresaId, fechaConsulta);
  }

  // GET /caja/activa?fecha=2026-02-26
  @Get('activa')
  @Roles('ADMIN', 'EMPLEADO')
  miCajaActiva(@Tenant() empresaId: string, @CurrentUser() user: any, @Query('fecha') fecha: string) {
    const fechaConsulta = fecha ?? fechaLocalHoy();
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
    const fecha = body.fecha ?? fechaLocalHoy();
    return this.cajaService.abrirCaja(
      empresaId,
      user.userId,
      body.montoInicial,
      fecha,
    );
  }

  // PATCH /caja/:id/cerrar
  @Patch(':id/cerrar')
  @Roles('ADMIN', 'EMPLEADO')
  cerrar(
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { efectivoReal: number; observaciones?: string },
  ) {
    return this.cajaService.cerrarCaja(
      id,
      empresaId,
      user.userId,
      body.efectivoReal,
      body.observaciones,
      user.rol,
    );
  }
}