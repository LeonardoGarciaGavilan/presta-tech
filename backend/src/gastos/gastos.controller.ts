import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { GastosService } from './gastos.service';
import { CreateGastoDto, UpdateGastoDto } from './dto/gastos.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('gastos')
@UseGuards(JwtAuthGuard)
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}

  // GET /gastos?desde=&hasta=&categoria=
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('desde')     desde:     string,
    @Query('hasta')     hasta:     string,
    @Query('categoria') categoria: string,
  ) {
    return this.gastosService.findAll(user, desde, hasta, categoria);
  }

  // GET /gastos/resumen
  @Get('resumen')
  resumen(@CurrentUser() user: any) {
    return this.gastosService.resumen(user);
  }

  // POST /gastos
  @Post()
  create(@Body() dto: CreateGastoDto, @CurrentUser() user: any) {
    return this.gastosService.create(dto, user);
  }

  // PUT /gastos/:id
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGastoDto, @CurrentUser() user: any) {
    return this.gastosService.update(id, dto, user);
  }

  // DELETE /gastos/:id
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.gastosService.remove(id, user);
  }
}