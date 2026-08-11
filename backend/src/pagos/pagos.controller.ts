import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PagosService } from './pagos.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { PermisosGuard } from '../common/guards/permisos.guard';
import { ModulosGuard } from '../common/guards/modulos.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { Modulo, RequierePermiso } from '../common/permisos/permisos.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('pagos')
@UseGuards(JwtAuthGuard, RolesGuard, ModulosGuard, PermisosGuard, SuperAdminGuard)
@Modulo('PAGOS')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post()
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('pagos:registrar')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  registrar(
    @Body() dto: CreatePagoDto,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    return this.pagosService.registrarPago(dto, empresaId, user.userId);
  }

  @Get('resumen')
  @Roles('ADMIN', 'EMPLEADO')
  getResumen(@Tenant() empresaId: string) {
    return this.pagosService.getResumen(empresaId);
  }

  @Get('prestamo/:prestamoId')
  @Roles('ADMIN', 'EMPLEADO')
  findByPrestamo(
    @Param('prestamoId') prestamoId: string,
    @Tenant() empresaId: string,
  ) {
    return this.pagosService.findByPrestamo(prestamoId, empresaId);
  }

  @Get()
  @Roles('ADMIN', 'EMPLEADO')
  findAll(@Tenant() empresaId: string) {
    return this.pagosService.findAll(empresaId);
  }

  @Get(':id')
  @Roles('ADMIN', 'EMPLEADO')
  findOne(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.pagosService.findOne(id, empresaId);
  }

  @Post('saldar/:id')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('pagos:registrar')
  @Idempotent()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  saldarPrestamo(
    @Param('id') id: string,
    @Body()
    body: {
      metodo: string;
      referencia?: string;
      observacion?: string;
      idempotencyKey?: string;
      fecha?: string;
    },
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    const usuarioId = user.sub ?? user.userId ?? user.id;
    return this.pagosService.saldarPrestamo(
      id,
      empresaId,
      usuarioId,
      body.metodo,
      body.referencia,
      body.observacion,
      body.idempotencyKey,
      body.fecha,
    );
  }
}
