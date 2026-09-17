import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoUbicacion } from '@prisma/client';

@Injectable()
export class UbicacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async getVersion(): Promise<{ version: string }> {
    const row = await this.prisma.ubicacionVersion.findUnique({
      where: { id: 1 },
    });
    return { version: row?.version ?? '0' };
  }

  async getCatalogo() {
    const [version, filas] = await Promise.all([
      this.prisma.ubicacionVersion.findUnique({ where: { id: 1 } }),
      this.prisma.ubicacion.findMany({
        orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
      }),
    ]);

    const porTipo = (tipo: TipoUbicacion) =>
      filas.filter((f) => f.tipo === tipo);

    return {
      version: version?.version ?? '0',
      conteos: {
        provincias: porTipo('PROVINCIA').length,
        municipios: porTipo('MUNICIPIO').length,
        distritos: porTipo('DISTRITO_MUNICIPAL').length,
        secciones: porTipo('SECCION').length,
        barrios: porTipo('BARRIO').length,
        subBarrios: porTipo('SUB_BARRIO').length,
      },
      provincias: porTipo('PROVINCIA'),
      municipios: porTipo('MUNICIPIO'),
      distritos: porTipo('DISTRITO_MUNICIPAL'),
      secciones: porTipo('SECCION'),
      barrios: porTipo('BARRIO'),
      subBarrios: porTipo('SUB_BARRIO'),
    };
  }

  async getProvincias() {
    return this.prisma.ubicacion.findMany({
      where: { tipo: 'PROVINCIA' },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async getUnidades(provinciaId: string) {
    const provincia = await this.prisma.ubicacion.findFirst({
      where: { id: provinciaId, tipo: 'PROVINCIA' },
      select: { id: true },
    });
    if (!provincia) {
      throw new NotFoundException('Provincia no encontrada');
    }

    const filas = await this.prisma.ubicacion.findMany({
      where: {
        tipo: { in: ['MUNICIPIO', 'DISTRITO_MUNICIPAL'] },
        provinciaId,
      },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        municipioNombre: true,
      },
    });

    return filas.sort((a, b) => {
      const da = a.tipo === 'MUNICIPIO' ? 0 : 1;
      const db = b.tipo === 'MUNICIPIO' ? 0 : 1;
      return da - db || a.nombre.localeCompare(b.nombre, 'es');
    });
  }

  async getSectores(unidadId: string, tipo?: TipoUbicacion) {
    const unidad = await this.prisma.ubicacion.findFirst({
      where: {
        id: unidadId,
        tipo: { in: ['MUNICIPIO', 'DISTRITO_MUNICIPAL'] },
      },
      select: { id: true },
    });
    if (!unidad) {
      throw new NotFoundException('Municipio o distrito no encontrado');
    }

    return this.prisma.ubicacion.findMany({
      where: {
        unidadPadreId: unidadId,
        ...(tipo && { tipo }),
      },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        padreId: true,
      },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    });
  }
}
