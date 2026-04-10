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
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { PrestamosService } from './prestamos.service';
import { CreatePrestamoDto } from './dto/create-prestamo.dto';
import { UpdatePrestamoDto } from './dto/update-prestamo.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FrecuenciaPago } from '@prisma/client';
import { RefinanciarPrestamoDto } from './dto/refinanciar-prestamo.dto';

@Controller('prestamos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrestamosController {
  constructor(private readonly prestamosService: PrestamosService) {}

  @Post()
  @Roles('ADMIN', 'EMPLEADO')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePrestamoDto, @Tenant() empresaId: string, @CurrentUser() user: any) {
    const usuarioId = user.sub ?? user.userId ?? user.id;
    return this.prestamosService.create(dto, empresaId, usuarioId);
  }

  @Get('resumen')
  @Roles('ADMIN', 'EMPLEADO')
  getResumen(@Tenant() empresaId: string) {
    return this.prestamosService.getResumen(empresaId);
  }

  @Get('calcular')
  @Roles('SUPERADMIN', 'ADMIN', 'EMPLEADO')
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
    if (!Object.values(FrecuenciaPago).includes(frecuenciaPago as FrecuenciaPago)) {
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
  @Roles('ADMIN')
  getSolicitudes(@Tenant() empresaId: string) {
    return this.prestamosService.getSolicitudes(empresaId);
  }

  @Get('alertas')
  @Roles('ADMIN', 'EMPLEADO')
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
  contarAlertas(@Tenant() empresaId: string) {
    return this.prestamosService
      .contarAlertasNoLeidas(empresaId)
      .then((count) => ({ count }));
  }

  @Patch('alertas/marcar-todas')
  @Roles('ADMIN', 'EMPLEADO')
  marcarTodasLeidas(@Tenant() empresaId: string) {
    return this.prestamosService.marcarTodasLeidas(empresaId);
  }

  @Patch('alertas/:alertaId/leer')
  @Roles('ADMIN', 'EMPLEADO')
  marcarLeida(@Param('alertaId') alertaId: string, @Tenant() empresaId: string) {
    return this.prestamosService.marcarAlertaLeida(
      alertaId,
      empresaId,
    );
  }

  @Get('cliente/:clienteId')
  @Roles('ADMIN', 'EMPLEADO')
  findByCliente(@Param('clienteId') clienteId: string, @Tenant() empresaId: string) {
    return this.prestamosService.findByCliente(clienteId, empresaId);
  }

  @Post('moras/actualizar')
  @Roles('ADMIN', 'EMPLEADO')
  actualizarMoras(@Tenant() empresaId: string) {
    return this.prestamosService.actualizarMoras(empresaId);
  }

  @Get()
  @Roles('ADMIN', 'EMPLEADO')
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
  findOne(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.prestamosService.findOne(id, empresaId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EMPLEADO')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePrestamoDto,
    @Tenant() empresaId: string,
  ) {
    return this.prestamosService.update(id, dto, empresaId);
  }

  @Patch(':id/cancelar')
  @Roles('ADMIN')
  cancelar(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any) {
    const usuarioId = user.sub ?? user.userId ?? user.id;
    return this.prestamosService.cancelar(id, empresaId, usuarioId);
  }

  @Patch(':id/estado')
  @Roles('ADMIN')
  cambiarEstado(
    @Param('id') id: string,
    @Body() body: { estado: string; motivo?: string },
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    const adminId = user.sub ?? user.userId ?? user.id;
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
  desembolsar(@Param('id') id: string, @Tenant() empresaId: string, @CurrentUser() user: any) {
    const adminId = user.sub ?? user.userId ?? user.id;
    return this.prestamosService.desembolsar(id, empresaId, adminId);
  }

  @Patch(':id/refinanciar')
  @Roles('ADMIN', 'EMPLEADO')
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