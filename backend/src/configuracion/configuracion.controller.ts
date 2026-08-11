import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { UpsertConfiguracionDto } from './dto/upsert-configuracion.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { PermisosGuard } from '../common/guards/permisos.guard';
import { ModulosGuard } from '../common/guards/modulos.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { Modulo, RequierePermiso } from '../common/permisos/permisos.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('configuracion')
@UseGuards(JwtAuthGuard, RolesGuard, ModulosGuard, PermisosGuard, SuperAdminGuard)
@Modulo('CONFIGURACION')
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  @Roles('ADMIN', 'EMPLEADO')
  findOne(@Tenant() empresaId: string) {
    return this.configuracionService.findOne(empresaId);
  }

  @Put()
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('configuracion:editar')
  upsert(
    @Body() dto: UpsertConfiguracionDto,
    @Tenant() empresaId: string,
    @CurrentUser() user: any,
  ) {
    return this.configuracionService.upsert(dto, empresaId, user.userId);
  }
}
