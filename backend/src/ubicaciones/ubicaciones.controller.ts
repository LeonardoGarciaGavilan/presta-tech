import {
  Controller,
  Get,
  Param,
  Query,
  ParseEnumPipe,
  UseGuards,
} from '@nestjs/common';
import { TipoUbicacion } from '@prisma/client';
import { UbicacionesService } from './ubicaciones.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';

@Controller('ubicaciones')
@UseGuards(JwtAuthGuard)
export class UbicacionesController {
  constructor(private readonly ubicacionesService: UbicacionesService) {}

  // GET /ubicaciones/version
  @Get('version')
  getVersion() {
    return this.ubicacionesService.getVersion();
  }

  // GET /ubicaciones/catalogo
  @Get('catalogo')
  getCatalogo() {
    return this.ubicacionesService.getCatalogo();
  }

  // GET /ubicaciones/provincias
  @Get('provincias')
  getProvincias() {
    return this.ubicacionesService.getProvincias();
  }

  // GET /ubicaciones/provincias/:id/unidades
  @Get('provincias/:id/unidades')
  getUnidades(@Param('id') id: string) {
    return this.ubicacionesService.getUnidades(id);
  }

  // GET /ubicaciones/unidades/:id/sectores?tipo=SECCION|BARRIO|SUB_BARRIO
  @Get('unidades/:id/sectores')
  getSectores(
    @Param('id') id: string,
    @Query('tipo', new ParseEnumPipe(TipoUbicacion, { optional: true }))
    tipo?: TipoUbicacion,
  ) {
    return this.ubicacionesService.getSectores(id, tipo);
  }
}
