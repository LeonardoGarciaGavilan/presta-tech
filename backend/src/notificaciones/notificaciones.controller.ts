// src/notificaciones/notificaciones.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { PermisosGuard } from '../common/guards/permisos.guard';
import { ModulosGuard } from '../common/guards/modulos.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { Modulo } from '../common/permisos/permisos.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard, ModulosGuard, PermisosGuard, SuperAdminGuard)
@Modulo('ALERTAS')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  // GET /notificaciones/alertas
  @Get('alertas')
  getAlertas(@CurrentUser() user: any) {
    return this.notificacionesService.getAlertas(user);
  }
}
