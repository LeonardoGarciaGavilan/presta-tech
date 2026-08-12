// src/empleados/empleados.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmpleadosService } from './empleados.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { PermisosGuard } from '../common/guards/permisos.guard';
import { ModulosGuard } from '../common/guards/modulos.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { Modulo, RequierePermiso } from '../common/permisos/permisos.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';

@Controller('empleados')
@UseGuards(JwtAuthGuard, ModulosGuard, PermisosGuard, SuperAdminGuard)
@Modulo('EMPLEADOS')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  // ─── Resumen / Stats ──────────────────────────────────────────────────────
  @Get('resumen')
  @RequierePermiso('empleados:ver')
  getResumen(@Tenant() empresaId: string) {
    return this.empleadosService.getResumen(empresaId);
  }

  // ─── CRUD Empleados ───────────────────────────────────────────────────────
  @Get()
  @RequierePermiso('empleados:ver')
  findAll(
    @Tenant() empresaId: string,
    @Query('inactivos') inactivos?: string,
  ) {
    return this.empleadosService.findAll(empresaId, inactivos !== 'true');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequierePermiso('empleados:gestionar')
  create(@Body() dto: any, @Tenant() empresaId: string) {
    return this.empleadosService.create(dto, empresaId);
  }

  @Patch(':id')
  @RequierePermiso('empleados:gestionar')
  update(@Param('id') id: string, @Body() dto: any, @Tenant() empresaId: string) {
    return this.empleadosService.update(id, dto, empresaId);
  }

  @Delete(':id')
  @RequierePermiso('empleados:gestionar')
  desactivar(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.empleadosService.desactivar(id, empresaId);
  }

  @Patch(':id/reactivar')
  @RequierePermiso('empleados:gestionar')
  reactivar(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.empleadosService.reactivar(id, empresaId);
  }

  // ─── Asistencia ───────────────────────────────────────────────────────────

  // GET /empleados/asistencia?fecha=2026-03-13
  @Get('asistencia')
  @RequierePermiso('empleados:asistencia')
  getAsistencia(@Tenant() empresaId: string, @Query('fecha') fecha: string) {
    const dia = fecha ?? new Date().toISOString().slice(0, 10);
    return this.empleadosService.getAsistencia(empresaId, dia);
  }

  // GET /empleados/:id/asistencia?mes=2026-03
  @Get(':id/asistencia')
  @RequierePermiso('empleados:asistencia')
  getAsistenciaMes(
    @Param('id') id: string,
    @Query('mes') mes: string,
    @Tenant() empresaId: string,
  ) {
    const m = mes ?? new Date().toISOString().slice(0, 7);
    return this.empleadosService.getAsistenciaMes(empresaId, id, m);
  }

  // POST /empleados/asistencia
  @Post('asistencia')
  @RequierePermiso('empleados:asistencia')
  registrarAsistencia(@Body() dto: any, @Tenant() empresaId: string) {
    return this.empleadosService.registrarAsistencia(empresaId, dto);
  }

  // ─── Descuentos ───────────────────────────────────────────────────────────

  // GET /empleados/:id/descuentos
  @Get(':id/descuentos')
  @RequierePermiso('empleados:pagosSalario')
  getDescuentos(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.empleadosService.getDescuentosPendientes(id, empresaId);
  }

  // POST /empleados/descuentos
  @Post('descuentos')
  @RequierePermiso('empleados:pagosSalario')
  crearDescuento(@Body() dto: any, @Tenant() empresaId: string) {
    return this.empleadosService.crearDescuento(empresaId, dto);
  }

  // DELETE /empleados/descuentos/:id
  @Delete('descuentos/:id')
  @RequierePermiso('empleados:pagosSalario')
  eliminarDescuento(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.empleadosService.eliminarDescuento(id, empresaId);
  }

  // ─── Pagos de salario ─────────────────────────────────────────────────────

  // GET /empleados/pagos?empleadoId=xxx
  @Get('pagos')
  @RequierePermiso('empleados:pagosSalario')
  getPagos(
    @Tenant() empresaId: string,
    @Query('empleadoId') empleadoId?: string,
  ) {
    return this.empleadosService.getPagos(empresaId, empleadoId);
  }

  // POST /empleados/pagos
  @Post('pagos')
  @RequierePermiso('empleados:pagosSalario')
  @Idempotent()
  registrarPago(@Body() dto: any, @Tenant() empresaId: string) {
    return this.empleadosService.registrarPago(empresaId, dto);
  }
}
