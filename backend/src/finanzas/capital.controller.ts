import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CapitalService } from './capital.service';
import { CreateInyeccionDto } from './dto/create-inyeccion.dto';
import { CreateRetiroDto } from './dto/create-retiro.dto';
import { CreateCapitalInicialDto } from './dto/create-capital.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { PermisosGuard } from '../common/guards/permisos.guard';
import { ModulosGuard } from '../common/guards/modulos.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { Modulo, RequierePermiso } from '../common/permisos/permisos.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('finanzas')
@UseGuards(JwtAuthGuard, ModulosGuard, PermisosGuard, SuperAdminGuard)
@Modulo('FINANZAS')
export class CapitalController {
  constructor(private readonly capitalService: CapitalService) {}

  @Get('dashboard')
  @RequierePermiso('finanzas:ver')
  async getDashboard(@Request() req: any) {
    return this.capitalService.getDashboard(req.user.empresaId);
  }

  @Get('rutas')
  @RequierePermiso('finanzas:ver')
  async getResumenRutas(@Request() req: any) {
    return this.capitalService.getResumenRutas(req.user.empresaId);
  }

  @Get('movimientos')
  @RequierePermiso('finanzas:ver')
  async getMovimientos(@Request() req: any, @Query('limite') limite?: string) {
    return this.capitalService.getMovimientos(
      req.user,
      limite ? parseInt(limite, 10) : 50,
    );
  }

  @Get('capital')
  @RequierePermiso('finanzas:ver')
  async getCapital(@Request() req: any) {
    return this.capitalService.getCapitalEmpresa(req.user.empresaId);
  }

  @Post('capital')
  @RequierePermiso('finanzas:inyeccionCapital')
  @Idempotent()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async registrarCapitalInicial(
    @Body() dto: CreateCapitalInicialDto,
    @Request() req: any,
  ) {
    return this.capitalService.registrarCapitalInicial(dto, req.user);
  }

  @Post('inyeccion')
  @RequierePermiso('finanzas:inyeccionCapital')
  @Idempotent()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async inyectarCapital(@Body() dto: CreateInyeccionDto, @Request() req: any) {
    return this.capitalService.inyectarCapital(dto, req.user);
  }

  @Get('retiros')
  @RequierePermiso('finanzas:ver')
  async getRetiros(@Request() req: any) {
    return this.capitalService.getRetiros(req.user);
  }

  @Post('retiro')
  @RequierePermiso('finanzas:retiroGanancias')
  @Idempotent()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async retirarGanancias(@Body() dto: CreateRetiroDto, @Request() req: any) {
    return this.capitalService.retirarGanancias(dto, req.user);
  }

  @Post('retiro-capital')
  @RequierePermiso('finanzas:retiroGanancias')
  @Idempotent()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async retirarCapital(@Body() dto: CreateRetiroDto, @Request() req: any) {
    return this.capitalService.retirarCapital(dto, req.user);
  }

  @Get('capital-retirable')
  @RequierePermiso('finanzas:ver')
  async getCapitalRetirable(@Request() req: any) {
    const retirable = await this.capitalService.calcularCapitalRetirable(
      req.user.empresaId,
    );
    return { capitalRetirable: retirable };
  }

  @Get('ganancias-disponibles')
  @RequierePermiso('finanzas:ver')
  async getGananciasDisponibles(@Request() req: any) {
    const disponibles = await this.capitalService.calcularGananciasDisponibles(
      req.user.empresaId,
    );
    return { disponibles };
  }

  @Get('resumen')
  @RequierePermiso('finanzas:ver')
  async getResumen(@Request() req: any) {
    return this.capitalService.getResumenFinanciero(req.user.empresaId);
  }

  @Get('balance')
  @RequierePermiso('finanzas:ver')
  async getBalance(@Request() req: any) {
    return this.capitalService.validarBalance(req.user.empresaId);
  }
}
