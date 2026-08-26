import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { PermisosGuard } from '../common/guards/permisos.guard';
import { ModulosGuard } from '../common/guards/modulos.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { Modulo, RequierePermiso } from '../common/permisos/permisos.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CobrosQueryDto } from './dto/cobros-query.dto';
import { CarteraQueryDto } from './dto/cartera-query.dto';
import { EstadoQueryDto } from './dto/estado-query.dto';
import { CajasQueryDto } from './dto/cajas-query.dto';
import { FlujoCajaQueryDto } from './dto/flujo-caja-query.dto';
import { DesempenoQueryDto } from './dto/desempeno-query.dto';
import { ProyeccionQueryDto } from './dto/proyeccion-query.dto';

@Controller('reportes')
@UseGuards(
  JwtAuthGuard,
  ModulosGuard,
  PermisosGuard,
  SuperAdminGuard,
)
@Modulo('REPORTES')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('cobros')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequierePermiso('reportes:exportar')
  cobrosPorPeriodo(
    @CurrentUser() user: any,
    @Query() query: CobrosQueryDto,
  ) {
    return this.reportesService.cobrosPorPeriodo(
      user,
      query.desde,
      query.hasta,
      query.provincia,
      query.pagina,
      query.porPagina,
    );
  }

  @Get('cartera-vencida')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequierePermiso('reportes:exportar')
  carteraVencida(
    @CurrentUser() user: any,
    @Query() query: CarteraQueryDto,
  ) {
    return this.reportesService.carteraVencida(
      user,
      query.provincia,
      query.pagina,
      query.porPagina,
    );
  }

  @Get('estado-general')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequierePermiso('reportes:exportar')
  estadoGeneral(
    @CurrentUser() user: any,
    @Query() query: EstadoQueryDto,
  ) {
    return this.reportesService.estadoGeneral(
      user,
      query.provincia,
      query.pagina,
      query.porPagina,
    );
  }

  @Get('cliente/:id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @RequierePermiso('pagos:ver')
  pagosPorCliente(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportesService.pagosPorCliente(user, id);
  }

  @Get('cajas')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequierePermiso('reportes:exportar')
  reporteCajas(
    @CurrentUser() user: any,
    @Query() query: CajasQueryDto,
  ) {
    return this.reportesService.reporteCajas(
      user,
      query.desde,
      query.hasta,
      query.usuarioId,
      query.pagina,
      query.porPagina,
    );
  }

  @Get('flujo-caja')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequierePermiso('reportes:exportar')
  flujoDeCaja(
    @CurrentUser() user: any,
    @Query() query: FlujoCajaQueryDto,
  ) {
    return this.reportesService.flujoDeCaja(
      user,
      query.desde,
      query.hasta,
      query.usuarioId,
    );
  }

  @Get('desempeno-cobrador')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequierePermiso('reportes:exportar')
  desempenoPorCobrador(
    @CurrentUser() user: any,
    @Query() query: DesempenoQueryDto,
  ) {
    return this.reportesService.desempenoPorCobrador(
      user,
      query.desde,
      query.hasta,
      query.usuarioId,
    );
  }

  @Get('proyeccion-cuotas')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequierePermiso('reportes:exportar')
  proyeccionCuotas(
    @CurrentUser() user: any,
    @Query() query: ProyeccionQueryDto,
  ) {
    return this.reportesService.proyeccionCuotas(
      user,
      query.provincia,
    );
  }
}
