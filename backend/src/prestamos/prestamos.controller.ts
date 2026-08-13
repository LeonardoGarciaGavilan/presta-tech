// src/prestamos/prestamos.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { PrestamosService } from './prestamos.service';
import { CreatePrestamoDto } from './dto/create-prestamo.dto';
import { UpdatePrestamoDto } from './dto/update-prestamo.dto';
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
import { Throttle } from '@nestjs/throttler';
import { FrecuenciaPago } from '@prisma/client';
import { RefinanciarPrestamoDto } from './dto/refinanciar-prestamo.dto';

@Controller('prestamos')
@UseGuards(JwtAuthGuard, RolesGuard, ModulosGuard, PermisosGuard, SuperAdminGuard)
@Modulo('PRESTAMOS')
export class PrestamosController {
  constructor(
    private readonly prestamosService: PrestamosService,
    private readonly permisosService: PermisosService,
  ) {}

  @Post()
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('prestamos:crear')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(
    @Body() dto: CreatePrestamoDto,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    const usuarioId = user.sub ?? user.userId ?? user.id;
    return this.prestamosService.create(dto, empresaId, usuarioId);
  }

  @Get('resumen')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('prestamos:ver')
  getResumen(@Tenant() empresaId: string) {
    return this.prestamosService.getResumen(empresaId);
  }

  @Get('calcular')
  @Roles('ADMIN', 'EMPLEADO')
  calcular(
    @Query('monto') monto: string,
    @Query('tasaInteres') tasaInteres: string,
    @Query('numeroCuotas') numeroCuotas: string,
    @Query('frecuenciaPago') frecuenciaPago: string,
  ) {
    if (!monto || !tasaInteres || !numeroCuotas || !frecuenciaPago) {
      throw new BadRequestException(
        'Los parámetros monto, tasaInteres, numeroCuotas y frecuenciaPago son requeridos',
      );
    }
    if (
      !Object.values(FrecuenciaPago).includes(frecuenciaPago as FrecuenciaPago)
    ) {
      throw new BadRequestException(
        `frecuenciaPago debe ser: ${Object.values(FrecuenciaPago).join(', ')}`,
      );
    }
    return this.prestamosService.calcularTabla(
      parseFloat(monto),
      parseFloat(tasaInteres),
      parseInt(numeroCuotas, 10),
      frecuenciaPago as FrecuenciaPago,
    );
  }

  @Get('solicitudes')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('prestamos:revisar')
  getSolicitudes(@Tenant() empresaId: string) {
    return this.prestamosService.getSolicitudes(empresaId);
  }

  @Get('alertas')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('alertas:ver')
  getAlertas(
    @Tenant() empresaId: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('soloNoLeidas') soloNoLeidas?: string,
  ) {
    return this.prestamosService.getAlertas(
      empresaId,
      desde,
      hasta,
      soloNoLeidas === 'true',
    );
  }

  @Get('alertas/contador')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('alertas:ver')
  contarAlertas(@Tenant() empresaId: string) {
    return this.prestamosService
      .contarAlertasNoLeidas(empresaId)
      .then((count) => ({ count }));
  }

  @Patch('alertas/marcar-todas')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('alertas:ver')
  marcarTodasLeidas(@Tenant() empresaId: string) {
    return this.prestamosService.marcarTodasLeidas(empresaId);
  }

  @Patch('alertas/:alertaId/leer')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('alertas:ver')
  marcarLeida(
    @Param('alertaId') alertaId: string,
    @Tenant() empresaId: string,
  ) {
    return this.prestamosService.marcarAlertaLeida(alertaId, empresaId);
  }

  @Get('cliente/:clienteId')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('prestamos:ver')
  findByCliente(
    @Param('clienteId') clienteId: string,
    @Tenant() empresaId: string,
  ) {
    return this.prestamosService.findByCliente(clienteId, empresaId);
  }

  @Post('moras/actualizar')
  @Roles('ADMIN')
  actualizarMoras(@Tenant() empresaId: string) {
    return this.prestamosService.actualizarMoras(empresaId);
  }

  @Get()
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('prestamos:ver')
  findAll(
    @Tenant() empresaId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search: string,
    @Query('estado') estado: string,
  ) {
    return this.prestamosService.findAll(
      empresaId,
      page,
      Math.min(limit, 1000),
      search,
      estado,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('prestamos:ver')
  findOne(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.prestamosService.findOne(id, empresaId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('prestamos:editar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePrestamoDto,
    @Tenant() empresaId: string,
  ) {
    return this.prestamosService.update(id, dto, empresaId);
  }

  @Patch(':id/cancelar')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('prestamos:cancelar')
  @Idempotent()
  cancelar(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    const usuarioId = user.sub ?? user.userId ?? user.id;
    return this.prestamosService.cancelar(id, empresaId, usuarioId);
  }

  @Patch(':id/estado')
  @Roles('ADMIN', 'EMPLEADO')
  @Idempotent()
  async cambiarEstado(
    @Param('id') id: string,
    @Body() body: { estado: string; motivo?: string },
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    const adminId = user.sub ?? user.userId ?? user.id;

    const permisoRequerido =
      body.estado === 'APROBADO'
        ? 'prestamos:aprobar'
        : body.estado === 'CANCELADO'
          ? 'prestamos:cancelar'
          : 'prestamos:revisar';

    if (!(await this.permisosService.tienePermiso(adminId, permisoRequerido))) {
      throw new ForbiddenException(
        `No tienes el permiso "${permisoRequerido}" para realizar esta acción.`,
      );
    }

    return this.prestamosService.cambiarEstado(
      id,
      empresaId,
      adminId,
      body.estado,
      body.motivo,
    );
  }

  @Patch(':id/desembolsar')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('prestamos:desembolsar')
  @Idempotent()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  desembolsar(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    const adminId = user.sub ?? user.userId ?? user.id;
    return this.prestamosService.desembolsar(id, empresaId, adminId);
  }

  @Patch(':id/refinanciar')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('prestamos:refinanciar')
  @Idempotent()
  refinanciar(
    @Param('id') id: string,
    @Body() dto: RefinanciarPrestamoDto,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    return this.prestamosService.refinanciar(
      id,
      dto,
      empresaId,
      user.sub ?? user.userId,
    );
  }
}
