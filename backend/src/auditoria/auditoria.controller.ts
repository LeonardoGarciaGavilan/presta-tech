// src/auditoria/auditoria.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { AuditoriaService } from './auditoria.service';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auditoria')
@UseGuards(JwtAuthGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Tenant() empresaId: string,
    @Query('empresaId') empresaFiltro?: string,
    @Query('tipo') tipo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.auditoriaService.findAll({
      user,
      empresaId,
      empresaFiltro,
      tipo,
      desde,
      hasta,
    });
  }
}