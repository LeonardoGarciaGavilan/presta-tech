// src/rutas/rutas.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RutasService } from './rutas.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { PermisosGuard } from '../common/guards/permisos.guard';
import { ModulosGuard } from '../common/guards/modulos.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { Modulo, RequierePermiso } from '../common/permisos/permisos.decorator';
import { PermisosService } from '../common/permisos/permisos.service';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';

@Controller('rutas')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
  ModulosGuard,
  PermisosGuard,
  SuperAdminGuard,
)
@Modulo('RUTAS')
export class RutasController {
  constructor(
    private readonly rutasService: RutasService,
    private readonly permisosService: PermisosService,
  ) {}

  private ctx(user: any) {
    return {
      empresaId: user.empresaId,
      usuarioId: user.sub ?? user.userId ?? user.id,
      isAdmin: user.rol === 'ADMIN',
    };
  }

  @Get()
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:ver')
  findAll(@Tenant() empresaId: string, @CurrentUser() user: any) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.findAll(empresaId, usuarioId, isAdmin);
  }

  @Post()
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:crear')
  @Idempotent()
  create(
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Body() body: { nombre: string; descripcion?: string },
  ) {
    const { usuarioId } = this.ctx(user);
    return this.rutasService.create(
      empresaId,
      usuarioId,
      body.nombre,
      body.descripcion,
    );
  }

  @Post('reset-visitados')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:marcarVisita')
  @Idempotent()
  resetVisitados(@Tenant() empresaId: string) {
    return this.rutasService.resetVisitados(empresaId);
  }

  @Patch('clientes/:rcId/visita')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:marcarVisita')
  @Idempotent()
  async marcarVisitado(
    @Param('rcId') rcId: string,
    @Body() body: { visitado: boolean },
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    const { usuarioId } = this.ctx(user);
    const puedeGestionar = await this.permisosService.tienePermiso(
      usuarioId,
      'rutas:asignar',
    );
    return this.rutasService.marcarVisitado(
      rcId,
      empresaId,
      usuarioId,
      body.visitado,
      puedeGestionar,
    );
  }

  @Get('usuarios')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:ver')
  getUsuarios(@Tenant() empresaId: string) {
    return this.rutasService.getUsuariosEmpresa(empresaId);
  }

  @Get('cliente/:clienteId')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:ver')
  getRutaDeCliente(
    @Param('clienteId') clienteId: string,
    @Tenant() empresaId: string,
  ) {
    return this.rutasService.getRutaDeCliente(clienteId, empresaId);
  }

  @Patch('cliente/:clienteId/asignar')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:asignar')
  asignarRuta(
    @Param('clienteId') clienteId: string,
    @Tenant() empresaId: string,
    @Body() body: { rutaId: string | null },
  ) {
    return this.rutasService.asignarRuta(clienteId, empresaId, body.rutaId);
  }

  @Get(':id')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:ver')
  findOne(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.findOne(id, empresaId, usuarioId, isAdmin);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:asignar')
  update(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Body() body: { nombre?: string; descripcion?: string; activa?: boolean },
  ) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.update(id, empresaId, usuarioId, isAdmin, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:eliminar')
  remove(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.remove(id, empresaId, usuarioId, isAdmin);
  }

  @Patch(':id/asignar-usuario')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:asignar')
  asignarUsuario(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @Body() body: { usuarioId: string },
  ) {
    return this.rutasService.asignarUsuario(id, empresaId, body.usuarioId);
  }

  @Get(':id/dia')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:ver')
  vistaDia(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Query('fecha') fecha: string,
  ) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.vistaDia(id, empresaId, usuarioId, isAdmin, fecha);
  }

  @Post(':id/generar-dia')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:marcarVisita')
  @Idempotent()
  generarRutaDia(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Body() body: { rutaClienteIds: string[]; fecha: string },
  ) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.generarRutaDia(
      id,
      empresaId,
      usuarioId,
      isAdmin,
      body.rutaClienteIds,
      body.fecha,
    );
  }

  @Post(':id/clientes')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:asignar')
  agregarCliente(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Body() body: { clienteId: string; observacion?: string },
  ) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.agregarCliente(
      id,
      empresaId,
      usuarioId,
      isAdmin,
      body.clienteId,
      body.observacion,
    );
  }

  @Patch(':id/clientes/:rcId')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:asignar')
  actualizarCliente(
    @Param('id') id: string,
    @Param('rcId') rcId: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Body() body: { observacion?: string; orden?: number },
  ) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.actualizarCliente(
      id,
      rcId,
      empresaId,
      usuarioId,
      isAdmin,
      body,
    );
  }

  @Delete(':id/clientes/:rcId')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:asignar')
  quitarCliente(
    @Param('id') id: string,
    @Param('rcId') rcId: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.quitarCliente(
      id,
      rcId,
      empresaId,
      usuarioId,
      isAdmin,
    );
  }

  @Patch(':id/reordenar')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('rutas:asignar')
  reordenar(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
    @Body() body: { orden: { id: string; orden: number }[] },
  ) {
    const { usuarioId, isAdmin } = this.ctx(user);
    return this.rutasService.reordenar(
      id,
      empresaId,
      usuarioId,
      isAdmin,
      body.orden,
    );
  }
}
