import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { PermisosGuard } from '../common/guards/permisos.guard';
import { ModulosGuard } from '../common/guards/modulos.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { Modulo, RequierePermiso } from '../common/permisos/permisos.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardMobileService } from './dashboard-mobile.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, ModulosGuard, PermisosGuard, SuperAdminGuard)
@Modulo('DASHBOARD')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly dashboardMobileService: DashboardMobileService,
  ) {}

  @Get()
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('dashboard:ver')
  getDashboard(@CurrentUser() user: any) {
    const empresaId = user.empresaId;
    return this.dashboardService.getDashboard(empresaId);
  }

  @Get('mobile')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('dashboard:ver')
  getDashboardMobile(@CurrentUser() user: any) {
    return this.dashboardMobileService.getDashboardMobile(
      user.empresaId,
      user.userId,
    );
  }
}
