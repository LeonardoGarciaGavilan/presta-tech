import {
  Controller, Get, Put, Patch, Body, UseGuards,
} from '@nestjs/common';
import { PerfilService } from './perfil.service';
import { UpdatePerfilDto, CambiarPasswordDto, UpdateEmpresaDto } from './dto/perfil.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('perfil')
@UseGuards(JwtAuthGuard)
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  // GET /perfil — datos del usuario + empresa
  @Get()
  getPerfil(@Tenant() empresaId: string, @CurrentUser() user: any) {
    return this.perfilService.getPerfil(user.userId, empresaId);
  }

  // PUT /perfil — actualizar nombre del usuario
  @Put()
  updatePerfil(@Body() dto: UpdatePerfilDto, @CurrentUser() user: any) {
    return this.perfilService.updatePerfil(user.userId, dto);
  }

  // PATCH /perfil/password — cambiar contraseña
  @Patch('password')
  cambiarPassword(@Body() dto: CambiarPasswordDto, @CurrentUser() user: any) {
    return this.perfilService.cambiarPassword(user.userId, dto);
  }

  // PUT /perfil/empresa — actualizar nombre empresa (solo ADMIN)
  @Put('empresa')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateEmpresa(@Body() dto: UpdateEmpresaDto, @Tenant() empresaId: string) {
    return this.perfilService.updateEmpresa(empresaId, dto);
  }
}