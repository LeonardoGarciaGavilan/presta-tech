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

@Controller('finanzas')
@UseGuards(JwtAuthGuard)
export class CapitalController {
  constructor(private readonly capitalService: CapitalService) {}

  @Get('dashboard')
  async getDashboard(@Request() req: any) {
    return this.capitalService.getDashboard(req.user.empresaId);
  }

  @Get('rutas')
  async getResumenRutas(@Request() req: any) {
    return this.capitalService.getResumenRutas(req.user.empresaId);
  }

  @Get('movimientos')
  async getMovimientos(
    @Request() req: any,
    @Query('limite') limite?: string,
  ) {
    return this.capitalService.getMovimientos(
      req.user,
      limite ? parseInt(limite, 10) : 50,
    );
  }

  @Get('capital')
  async getCapital(@Request() req: any) {
    return this.capitalService.getCapitalEmpresa(req.user.empresaId);
  }

  @Post('capital')
  async registrarCapitalInicial(
    @Body() dto: CreateCapitalInicialDto,
    @Request() req: any,
  ) {
    return this.capitalService.registrarCapitalInicial(dto, req.user);
  }

  @Post('inyeccion')
  async inyectarCapital(
    @Body() dto: CreateInyeccionDto,
    @Request() req: any,
  ) {
    return this.capitalService.inyectarCapital(dto, req.user);
  }

  @Get('retiros')
  async getRetiros(@Request() req: any) {
    return this.capitalService.getRetiros(req.user);
  }

  @Post('retiro')
  async retirarGanancias(
    @Body() dto: CreateRetiroDto,
    @Request() req: any,
  ) {
    return this.capitalService.retirarGanancias(dto, req.user);
  }

  @Get('ganancias-disponibles')
  async getGananciasDisponibles(@Request() req: any) {
    const disponibles = await this.capitalService.calcularGananciasDisponibles(
      req.user.empresaId,
    );
    return { disponibles };
  }

  @Get('resumen')
  async getResumen(@Request() req: any) {
    return this.capitalService.getResumenFinanciero(req.user.empresaId);
  }
}