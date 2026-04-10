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
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('pagos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post()
  @Roles('ADMIN', 'EMPLEADO')
  @HttpCode(HttpStatus.CREATED)
  registrar(@Body() dto: CreatePagoDto, @Tenant() empresaId: string, @CurrentUser() user: any) {
    return this.pagosService.registrarPago(
      dto,
      empresaId,
      user.userId,
    );
  }

  @Get('resumen')
  @Roles('ADMIN', 'EMPLEADO')
  getResumen(@Tenant() empresaId: string) {
    return this.pagosService.getResumen(empresaId);
  }

  @Get('prestamo/:prestamoId')
  @Roles('ADMIN', 'EMPLEADO')
  findByPrestamo(@Param('prestamoId') prestamoId: string, @Tenant() empresaId: string) {
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
  saldarPrestamo(
    @Param('id') id: string,
    @Body() body: { metodo: string; referencia?: string; observacion?: string },
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
    );
  }
}