// src/superadmin/superadmin.controller.ts
import {
  Controller, Get, Post, Patch, Param, Body, Request, UseGuards,
} from '@nestjs/common';
import { SuperAdminService } from './superadmin.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';

@Controller('superadmin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  // GET /superadmin/estadisticas
  @Get('estadisticas')
  estadisticasGlobales(@Request() req) {
    return this.superAdminService.estadisticasGlobales(req.user);
  }

  // GET /superadmin/empresas
  @Get('empresas')
  listarEmpresas(@Request() req) {
    return this.superAdminService.listarEmpresas(req.user);
  }

  // GET /superadmin/empresas/:id
  @Get('empresas/:id')
  detalleEmpresa(@Request() req, @Param('id') id: string) {
    return this.superAdminService.detalleEmpresa(req.user, id);
  }

  // GET /superadmin/empresas/:id/usuarios
  @Get('empresas/:id/usuarios')
  listarUsuariosEmpresa(@Request() req, @Param('id') id: string) {
    return this.superAdminService.listarUsuariosEmpresa(req.user, id);
  }

  // POST /superadmin/empresas
  @Post('empresas')
  crearEmpresa(@Request() req, @Body() body: {
    nombreEmpresa: string; nombreAdmin: string; emailAdmin: string;
    passwordAdmin: string; tasaInteresBase?: number;
    moraPorcentajeMensual?: number; diasGracia?: number;
  }) {
    return this.superAdminService.crearEmpresa(req.user, body);
  }

  // PATCH /superadmin/empresas/:id
  @Patch('empresas/:id')
  editarEmpresa(@Request() req, @Param('id') id: string, @Body() body: { nombre: string }) {
    return this.superAdminService.editarEmpresa(req.user, id, body.nombre);
  }

  // PATCH /superadmin/empresas/:id/toggle
  @Patch('empresas/:id/toggle')
  toggleEmpresa(@Request() req, @Param('id') id: string, @Body() body: { activa: boolean }) {
    return this.superAdminService.toggleEmpresa(req.user, id, body.activa);
  }

  // PATCH /superadmin/usuarios/:id/reset-password
  @Patch('usuarios/:id/reset-password')
  resetearPassword(@Request() req, @Param('id') id: string, @Body() body: { nuevaPassword: string }) {
    return this.superAdminService.resetearPassword(req.user, id, body.nuevaPassword);
  }
}