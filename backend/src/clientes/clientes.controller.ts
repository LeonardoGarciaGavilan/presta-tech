import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Query, ParseIntPipe, DefaultValuePipe,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Roles('ADMIN', 'EMPLEADO')
  create(@Body() dto: CreateClienteDto, @Tenant() empresaId: string) {
    return this.clientesService.create(dto, empresaId);
  }

  @Get()
  @Roles('ADMIN', 'EMPLEADO')
  findAll(
    @Tenant() empresaId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search: string,
  ) {
    const porPagina = Math.min(limit, 1000);
    return this.clientesService.findAll(empresaId, page, porPagina, search);
  }

  @Get('inactivos')
  @Roles('ADMIN')
  findInactivos(
    @Tenant() empresaId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search: string,
  ) {
    const porPagina = Math.min(limit, 100);
    return this.clientesService.findInactivos(empresaId, page, porPagina, search);
  }

  @Get(':id')
  @Roles('ADMIN', 'EMPLEADO')
  findOne(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.clientesService.findOne(id, empresaId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EMPLEADO')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto, @Tenant() empresaId: string) {
    return this.clientesService.update(id, dto, empresaId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.clientesService.remove(id, empresaId);
  }

  @Patch(':id/reactivar')
  @Roles('ADMIN')
  reaccionar(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.clientesService.reactivar(id, empresaId);
  }

  @Post(':id/cedula')
  @Roles('ADMIN', 'EMPLEADO')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new BadRequestException('Formato no permitido. Use JPG, PNG o WebP'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadCedula(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('tipo') tipo: string,
  ) {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }
    if (!tipo || !['cedula-frontal', 'cedula-trasera'].includes(tipo)) {
      throw new BadRequestException('tipo debe ser cedula-frontal o cedula-trasera');
    }
    return this.clientesService.uploadCedula(
      id,
      empresaId,
      tipo as 'cedula-frontal' | 'cedula-trasera',
      file.buffer,
      file.mimetype,
    );
  }

@Post('test-upload')
@UseInterceptors(FileInterceptor('file'))
test(@UploadedFile() file: any) {
  console.log(file);
  return file;
}

  @Get(':id/cedula/signed-url')
  @Roles('ADMIN', 'EMPLEADO')
  getCedulaSignedUrl(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @Query('tipo') tipo: string,
  ) {
    if (!tipo || !['cedula-frontal', 'cedula-trasera'].includes(tipo)) {
      throw new BadRequestException('tipo debe ser cedula-frontal o cedula-trasera');
    }
    return this.clientesService.getCedulaSignedUrl(
      id,
      empresaId,
      tipo as 'cedula-frontal' | 'cedula-trasera',
    );
  }
}