import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { PermisosGuard } from '../common/guards/permisos.guard';
import { ModulosGuard } from '../common/guards/modulos.guard';
import { SuperAdminGuard } from '../common/guards/superadmin.guard';
import { Modulo, RequierePermiso } from '../common/permisos/permisos.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { Throttle } from '@nestjs/throttler';

@UseGuards(JwtAuthGuard, RolesGuard, ModulosGuard, PermisosGuard, SuperAdminGuard)
@Controller('clientes')
@Modulo('CLIENTES')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('clientes:crear')
  @Idempotent()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(@Body() dto: CreateClienteDto, @Tenant() empresaId: string) {
    return this.clientesService.create(dto, empresaId);
  }

  @Get()
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('clientes:ver')
  findAll(
    @Tenant() empresaId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search: string,
    @Query('ids') ids?: string,
  ) {
    const porPagina = Math.min(limit, 1000);
    const parsedIds = ids ? ids.split(',').filter(Boolean) : undefined;
    return this.clientesService.findAll(
      empresaId,
      page,
      porPagina,
      search,
      parsedIds,
    );
  }

  @Get('inactivos')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('clientes:ver')
  findInactivos(
    @Tenant() empresaId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search: string,
  ) {
    const porPagina = Math.min(limit, 100);
    return this.clientesService.findInactivos(
      empresaId,
      page,
      porPagina,
      search,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('clientes:ver')
  findOne(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.clientesService.findOne(id, empresaId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('clientes:editar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClienteDto,
    @Tenant() empresaId: string,
  ) {
    return this.clientesService.update(id, dto, empresaId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('clientes:desactivar')
  remove(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.clientesService.remove(id, empresaId);
  }

  @Patch(':id/reactivar')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('clientes:desactivar')
  reaccionar(@Param('id') id: string, @Tenant() empresaId: string) {
    return this.clientesService.reactivar(id, empresaId);
  }

  @Post(':id/cedula')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('clientes:editar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Formato no permitido. Use JPG, PNG o WebP',
            ),
            false,
          );
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
      throw new BadRequestException(
        'tipo debe ser cedula-frontal o cedula-trasera',
      );
    }
    return this.clientesService.uploadCedula(
      id,
      empresaId,
      tipo as 'cedula-frontal' | 'cedula-trasera',
      file.buffer,
      file.mimetype,
    );
  }

  @Get(':id/cedula/signed-url')
  @Roles('ADMIN', 'EMPLEADO')
  @RequierePermiso('clientes:ver')
  getCedulaSignedUrl(
    @Param('id') id: string,
    @Tenant() empresaId: string,
    @Query('tipo') tipo: string,
  ) {
    if (!tipo || !['cedula-frontal', 'cedula-trasera'].includes(tipo)) {
      throw new BadRequestException(
        'tipo debe ser cedula-frontal o cedula-trasera',
      );
    }
    return this.clientesService.getCedulaSignedUrl(
      id,
      empresaId,
      tipo as 'cedula-frontal' | 'cedula-trasera',
    );
  }
}
