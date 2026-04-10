import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('cobros')
  @Roles('ADMIN')
  cobrosPorPeriodo(
    @CurrentUser() user: any,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('provincia') provincia: string,
  ) {
    return this.reportesService.cobrosPorPeriodo(
      user,
      desde,
      hasta,
      provincia,
    );
  }

  @Get('cartera-vencida')
  @Roles('ADMIN')
  carteraVencida(@CurrentUser() user: any, @Query('provincia') provincia: string) {
    return this.reportesService.carteraVencida(user, provincia);
  }

  @Get('estado-general')
  @Roles('ADMIN')
  estadoGeneral(@CurrentUser() user: any, @Query('provincia') provincia: string) {
    return this.reportesService.estadoGeneral(user, provincia);
  }

  @Get('cliente/:id')
  @Roles('ADMIN', 'EMPLEADO')
  pagosPorCliente(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportesService.pagosPorCliente(user, id);
  }

  @Get('cajas')
  @Roles('ADMIN')
  reporteCajas(
    @CurrentUser() user: any,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('usuarioId') usuarioId: string,
  ) {
    return this.reportesService.reporteCajas(
      user,
      desde,
      hasta,
      usuarioId || undefined,
    );
  }
}