// src/rutas/rutas.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { RutasService } from './rutas.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('rutas')
@UseGuards(JwtAuthGuard)
export class RutasController {
  constructor(private readonly rutasService: RutasService) {}

  private ctx(user: any) {
    return {
      empresaId: user.empresaId,
      usuarioId: user.sub ?? user.userId ?? user.id,
      isAdmin:   user.rol === 'ADMIN',
    };
  }

  @Get()
  findAll(@Tenant() empresaId: string, @CurrentUser() user: any) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.findAll(empresaId, usuarioId, isAdmin);
  }

  @Post()
  create(@Tenant() empresaId: string, @CurrentUser() user: any, @Body() body: { nombre: string; descripcion?: string }) {
    const { usuarioId } = this.ctx(user);
    return this.rutasService.create(empresaId, usuarioId, body.nombre, body.descripcion);
  }

  @Post('reset-visitados')
  resetVisitados(@Tenant() empresaId: string) {
    return this.rutasService.resetVisitados(empresaId);
  }

  @Patch('clientes/:rcId/visita')
  marcarVisitado(@Param('rcId') rcId: string, @Body() body: { visitado: boolean }, @Tenant() empresaId: string, @CurrentUser() user: any) {
    const { usuarioId } = this.ctx(user);
    return this.rutasService.marcarVisitado(rcId, empresaId, usuarioId, body.visitado);
  }

  @Get('usuarios')
  getUsuarios(@Tenant() empresaId: string, @CurrentUser() user: any) {
    const { isAdmin } = this.ctx(user);
    if (!isAdmin) throw new ForbiddenException('Solo administradores');
    return this.rutasService.getUsuariosEmpresa(empresaId);
  }

  @Get('cliente/:clienteId')
  getRutaDeCliente(@Param('clienteId') clienteId: string, @Tenant() empresaId: string) {
    return this.rutasService.getRutaDeCliente(clienteId, empresaId);
  }

  @Patch('cliente/:clienteId/asignar')
  asignarRuta(@Param('clienteId') clienteId: string, @Tenant() empresaId: string, @Body() body: { rutaId: string | null }) {
    return this.rutasService.asignarRuta(clienteId, empresaId, body.rutaId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.findOne(id, empresaId, usuarioId, isAdmin);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any, @Body() body: { nombre?: string; descripcion?: string; activa?: boolean }) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.update(id, empresaId, usuarioId, isAdmin, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.remove(id, empresaId, usuarioId, isAdmin);
  }

  @Patch(':id/asignar-usuario')
  asignarUsuario(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any, @Body() body: { usuarioId: string }) {
    const { isAdmin } = this.ctx(user);
    if (!isAdmin) throw new ForbiddenException('Solo administradores');
    return this.rutasService.asignarUsuario(id, empresaId, body.usuarioId);
  }

  @Get(':id/dia')
  vistaDia(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any, @Query('fecha') fecha: string) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.vistaDia(id, empresaId, usuarioId, isAdmin, fecha);
  }

  @Post(':id/generar-dia')
  generarRutaDia(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any, @Body() body: { rutaClienteIds: string[]; fecha: string }) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.generarRutaDia(id, empresaId, usuarioId, isAdmin, body.rutaClienteIds, body.fecha);
  }

  @Post(':id/clientes')
  agregarCliente(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any, @Body() body: { clienteId: string; observacion?: string }) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.agregarCliente(id, empresaId, usuarioId, isAdmin, body.clienteId, body.observacion);
  }

  @Patch(':id/clientes/:rcId')
  actualizarCliente(@Param('id') id: string, @Param('rcId') rcId: string, @Tenant() empresaId: string, @CurrentUser() user: any, @Body() body: { observacion?: string; orden?: number }) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.actualizarCliente(id, rcId, empresaId, usuarioId, isAdmin, body);
  }

  @Delete(':id/clientes/:rcId')
  quitarCliente(@Param('id') id: string, @Param('rcId') rcId: string, @Tenant() empresaId: string, @CurrentUser() user: any) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.quitarCliente(id, rcId, empresaId, usuarioId, isAdmin);
  }

  @Patch(':id/reordenar')
  reordenar(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any, @Body() body: { orden: { id: string; orden: number }[] }) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.reordenar(id, empresaId, usuarioId, isAdmin, body.orden);
  }
}