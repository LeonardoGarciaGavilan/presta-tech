// src/empleados/empleados.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
  HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { EmpleadosService } from './empleados.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const soloAdmin = (user: any) => {
  if (user?.rol !== 'ADMIN') {
    throw new ForbiddenException('Solo el administrador puede gestionar empleados');
  }
};

@Controller('empleados')
@UseGuards(JwtAuthGuard)
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  // ─── Resumen / Stats ──────────────────────────────────────────────────────
  @Get('resumen')
  getResumen(@Tenant() empresaId: string, @CurrentUser() user: any) {
    soloAdmin(user);
    return this.empleadosService.getResumen(empresaId);
  }

  // ─── CRUD Empleados ───────────────────────────────────────────────────────
  @Get()
  findAll(@Tenant() empresaId: string, @CurrentUser() user: any, @Query('inactivos') inactivos?: string) {
    soloAdmin(user);
    return this.empleadosService.findAll(empresaId, inactivos !== 'true');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: any, @Tenant() empresaId: string, @CurrentUser() user: any) {
    soloAdmin(user);
    return this.empleadosService.create(dto, empresaId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any, @Tenant() empresaId: string, @CurrentUser() user: any) {
    soloAdmin(user);
    return this.empleadosService.update(id, dto, empresaId);
  }

  @Delete(':id')
  desactivar(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any) {
    soloAdmin(user);
    return this.empleadosService.desactivar(id, empresaId);
  }

  @Patch(':id/reactivar')
  reactivar(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any) {
    soloAdmin(user);
    return this.empleadosService.reactivar(id, empresaId);
  }

  // ─── Asistencia ───────────────────────────────────────────────────────────

  // GET /empleados/asistencia?fecha=2026-03-13
  @Get('asistencia')
  getAsistencia(@Tenant() empresaId: string, @CurrentUser() user: any, @Query('fecha') fecha: string) {
    soloAdmin(user);
    const dia = fecha ?? new Date().toISOString().slice(0, 10);
    return this.empleadosService.getAsistencia(empresaId, dia);
  }

  // GET /empleados/:id/asistencia?mes=2026-03
  @Get(':id/asistencia')
  getAsistenciaMes(
    @Param('id') id: string,
    @Query('mes') mes: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    soloAdmin(user);
    const m = mes ?? new Date().toISOString().slice(0, 7);
    return this.empleadosService.getAsistenciaMes(empresaId, id, m);
  }

  // POST /empleados/asistencia
  @Post('asistencia')
  registrarAsistencia(@Body() dto: any, @Tenant() empresaId: string, @CurrentUser() user: any) {
    soloAdmin(user);
    return this.empleadosService.registrarAsistencia(empresaId, dto);
  }

  // ─── Descuentos ───────────────────────────────────────────────────────────

  // GET /empleados/:id/descuentos
  @Get(':id/descuentos')
  getDescuentos(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any) {
    soloAdmin(user);
    return this.empleadosService.getDescuentosPendientes(id, empresaId);
  }

  // POST /empleados/descuentos
  @Post('descuentos')
  crearDescuento(@Body() dto: any, @Tenant() empresaId: string, @CurrentUser() user: any) {
    soloAdmin(user);
    return this.empleadosService.crearDescuento(empresaId, dto);
  }

  // DELETE /empleados/descuentos/:id
  @Delete('descuentos/:id')
  eliminarDescuento(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any) {
    soloAdmin(user);
    return this.empleadosService.eliminarDescuento(id, empresaId);
  }

  // ─── Pagos de salario ─────────────────────────────────────────────────────

  // GET /empleados/pagos?empleadoId=xxx
  @Get('pagos')
  getPagos(@Tenant() empresaId: string, @CurrentUser() user: any, @Query('empleadoId') empleadoId?: string) {
    soloAdmin(user);
    return this.empleadosService.getPagos(empresaId, empleadoId);
  }

  // POST /empleados/pagos
  @Post('pagos')
  registrarPago(@Body() dto: any, @Tenant() empresaId: string, @CurrentUser() user: any) {
    soloAdmin(user);
    return this.empleadosService.registrarPago(empresaId, dto);
  }
}