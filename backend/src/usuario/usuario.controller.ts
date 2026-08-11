import {
  Controller,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Get,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsuarioService } from './usuario.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { PermisosGuard } from '../common/guards/permisos.guard';
import { ModulosGuard } from '../common/guards/modulos.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { Modulo, RequierePermiso } from '../common/permisos/permisos.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('usuarios')
@Modulo('USUARIOS')
export class UsuarioController {
  constructor(private usuarioService: UsuarioService) {}

  // POST /usuarios — crear empleado (ADMIN o con usuarios:gestionar)
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    ModulosGuard,
    PermisosGuard,
    SuperAdminGuard,
  )
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('usuarios:gestionar')
  @Post()
  crearEmpleado(
    @CurrentUser() user: any,
    @Body() body: { nombre: string; email: string; rol?: string },
  ) {
    return this.usuarioService.crearEmpleado(user, body);
  }

  // GET /usuarios — listar todos (requiere usuarios:ver)
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    ModulosGuard,
    PermisosGuard,
    SuperAdminGuard,
  )
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('usuarios:ver')
  @Get()
  listarUsuarios(@CurrentUser() user: any) {
    return this.usuarioService.listarUsuarios(user);
  }

  // PUT /usuarios/:id — editar nombre, rol, activo (usuarios:gestionar)
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    ModulosGuard,
    PermisosGuard,
    SuperAdminGuard,
  )
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('usuarios:gestionar')
  @Put(':id')
  actualizarUsuario(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { nombre?: string; rol?: string; activo?: boolean },
  ) {
    return this.usuarioService.actualizarUsuario(user, id, body);
  }

  // GET /usuarios/:id/permisos — matriz tri-estado de un usuario (usuarios:gestionar)
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    ModulosGuard,
    PermisosGuard,
    SuperAdminGuard,
  )
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('usuarios:gestionar')
  @Get(':id/permisos')
  obtenerPermisos(@CurrentUser() user: any, @Param('id') id: string) {
    return this.usuarioService.obtenerPermisos(user, id);
  }

  // PUT /usuarios/:id/permisos — guardar matriz + bump authVersion (usuarios:gestionar)
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    ModulosGuard,
    PermisosGuard,
    SuperAdminGuard,
  )
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('usuarios:gestionar')
  @Put(':id/permisos')
  actualizarPermisos(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { permisos?: string[]; permisosNegados?: string[] },
  ) {
    return this.usuarioService.actualizarPermisos(user, id, body);
  }

  // PATCH /usuarios/:id/reset-password — resetear a temporal (usuarios:resetPassword)
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    ModulosGuard,
    PermisosGuard,
    SuperAdminGuard,
  )
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('usuarios:resetPassword')
  @Throttle({ password: { limit: 3, ttl: 300_000 } })
  @Patch(':id/reset-password')
  resetPassword(@CurrentUser() user: any, @Param('id') id: string) {
    return this.usuarioService.resetPassword(user, id);
  }

  // POST /usuarios/cambiar-password — el propio usuario cambia su clave
  @UseGuards(JwtAuthGuard, ModulosGuard, PermisosGuard, SuperAdminGuard)
  @Throttle({ password: { limit: 3, ttl: 300_000 } })
  @Post('cambiar-password')
  cambiarPassword(
    @CurrentUser() user: any,
    @Body() body: { nuevaPassword: string },
  ) {
    return this.usuarioService.cambiarPassword(user, body.nuevaPassword);
  }

  // PATCH /usuarios/push-token — registrar token de push notification
  @UseGuards(JwtAuthGuard, ModulosGuard, PermisosGuard, SuperAdminGuard)
  @Patch('push-token')
  registrarPushToken(
    @CurrentUser() user: any,
    @Body() body: { pushToken: string },
  ) {
    return this.usuarioService.registrarPushToken(user.userId, body.pushToken);
  }

  // DELETE /usuarios/push-token — limpiar token al cerrar sesión
  @UseGuards(JwtAuthGuard, ModulosGuard, PermisosGuard, SuperAdminGuard)
  @Delete('push-token')
  limpiarPushToken(@CurrentUser() user: any) {
    return this.usuarioService.limpiarPushToken(user.userId);
  }
}
