// src/common/quota/quota.controller.ts
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { JwtAuthGuard } from '../../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles/roles.guard';
import { Roles } from '../../auth/roles/roles.decorator';
import { SuperAdminGuard } from '../guards/superadmin.guard';

// GET /cuotas — estado en vivo de las cuotas de la empresa del usuario (aviso 90%)
@Controller('cuotas')
@UseGuards(JwtAuthGuard, RolesGuard, SuperAdminGuard)
@Roles('ADMIN', 'EMPLEADO')
export class QuotaController {
  constructor(private readonly quotaService: QuotaService) {}

  @Get()
  estado(@Request() req: { user?: { empresaId?: string } }) {
    return this.quotaService.estadoCuotas(req.user?.empresaId ?? '');
  }
}
