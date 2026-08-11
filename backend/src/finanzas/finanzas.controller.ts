// finanzas.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FinanzasService } from './finanzas.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { PermisosGuard } from '../common/guards/permisos.guard';
import { ModulosGuard } from '../common/guards/modulos.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { Modulo, RequierePermiso } from '../common/permisos/permisos.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';

@Controller('finanzas')
@UseGuards(JwtAuthGuard, ModulosGuard, PermisosGuard, SuperAdminGuard)
@Modulo('FINANZAS')
export class FinanzasController {
  constructor(private readonly finanzasService: FinanzasService) {}

  // GET /finanzas/resumen?desde=2026-01-01&hasta=2026-03-31&meses=6
  @Get('resumen')
  @RequierePermiso('finanzas:ver')
  resumen(
    @Tenant() empresaId: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('meses') meses: string,
  ) {
    return this.finanzasService.resumenMensual(
      empresaId,
      desde,
      hasta,
      meses ? parseInt(meses, 10) : 6,
    );
  }
}
