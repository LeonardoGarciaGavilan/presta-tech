import {
  Controller, Post, Put, Patch,
  Body, Param, UseGuards, Get,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsuarioService } from './usuario.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('usuarios')
export class UsuarioController {
  constructor(private usuarioService: UsuarioService) {}

  // POST /usuarios — crear empleado (ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  crearEmpleado(@CurrentUser() user: any, @Body() body: { nombre: string; email: string; rol?: string }) {
    return this.usuarioService.crearEmpleado(user, body);
  }

  // GET /usuarios — listar todos (ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  listarUsuarios(@CurrentUser() user: any) {
    return this.usuarioService.listarUsuarios(user);
  }

  // PUT /usuarios/:id — editar nombre, rol, activo (ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  actualizarUsuario(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { nombre?: string; rol?: string; activo?: boolean },
  ) {
    return this.usuarioService.actualizarUsuario(user, id, body);
  }

  // PATCH /usuarios/:id/reset-password — resetear a temporal (ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Throttle({ password: { limit: 3, ttl: 300_000 } })
  @Patch(':id/reset-password')
  resetPassword(@CurrentUser() user: any, @Param('id') id: string) {
    return this.usuarioService.resetPassword(user, id);
  }

  // POST /usuarios/cambiar-password — el propio usuario cambia su clave
  @UseGuards(JwtAuthGuard)
  @Throttle({ password: { limit: 3, ttl: 300_000 } })
  @Post('cambiar-password')
  cambiarPassword(@CurrentUser() user: any, @Body() body: { nuevaPassword: string }) {
    return this.usuarioService.cambiarPassword(user, body.nuevaPassword);
  }
}