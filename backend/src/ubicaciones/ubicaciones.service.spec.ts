import { UbicacionesService } from './ubicaciones.service';
import type { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { TipoUbicacion } from '@prisma/client';

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    ubicacionVersion: { findUnique: jest.fn().mockResolvedValue(null) },
    ubicacion: { findMany: jest.fn(), findFirst: jest.fn() },
    ...overrides,
  };
  const service = new UbicacionesService(prisma as unknown as PrismaService);
  return { service, prisma };
}

const filaUbicacion = (
  id: string,
  tipo: string,
  nombre: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  codigoOrigen: 1,
  nombre,
  tipo,
  padreId: null,
  unidadPadreId: null,
  provinciaId: null,
  municipioId: null,
  municipioNombre: null,
  orden: 0,
  ...extra,
});

describe('UbicacionesService', () => {
  describe('getVersion', () => {
    it('devuelve la versión registrada', async () => {
      const { service, prisma } = buildService();
      prisma.ubicacionVersion.findUnique.mockResolvedValue({
        id: 1,
        version: 'abc123',
      });
      await expect(service.getVersion()).resolves.toEqual({
        version: 'abc123',
      });
    });

    it('devuelve "0" si aún no hay catálogo cargado', async () => {
      const { service } = buildService();
      await expect(service.getVersion()).resolves.toEqual({ version: '0' });
    });
  });

  describe('getCatalogo', () => {
    it('agrupa por tipo y reporta conteos', async () => {
      const { service, prisma } = buildService();
      prisma.ubicacionVersion.findUnique.mockResolvedValue({
        id: 1,
        version: 'v-1',
      });
      prisma.ubicacion.findMany.mockResolvedValue([
        filaUbicacion('PROVINCIA:1', 'PROVINCIA', 'Distrito Nacional'),
        filaUbicacion('MUNICIPIO:1', 'MUNICIPIO', 'Santo Domingo de Guzmán'),
        filaUbicacion(
          'DISTRITO_MUNICIPAL:1',
          'DISTRITO_MUNICIPAL',
          'Barro Arriba',
        ),
        filaUbicacion('SECCION:1', 'SECCION', 'Zona A'),
        filaUbicacion('BARRIO:1', 'BARRIO', 'Los Peralejos'),
        filaUbicacion('SUB_BARRIO:1', 'SUB_BARRIO', 'Los Peralejos'),
      ]);

      const catalogo = await service.getCatalogo();
      expect(catalogo.version).toBe('v-1');
      expect(catalogo.conteos).toEqual({
        provincias: 1,
        municipios: 1,
        distritos: 1,
        secciones: 1,
        barrios: 1,
        subBarrios: 1,
      });
      expect(catalogo.provincias[0].id).toBe('PROVINCIA:1');
      expect(catalogo.subBarrios).toHaveLength(1);
    });
  });

  describe('getProvincias', () => {
    it('devuelve solo provincias con id y nombre', async () => {
      const { service, prisma } = buildService();
      const provincias = [
        { id: 'PROVINCIA:32', nombre: 'Santiago' },
        { id: 'PROVINCIA:1', nombre: 'Distrito Nacional' },
      ];
      prisma.ubicacion.findMany.mockResolvedValue(provincias);
      await expect(service.getProvincias()).resolves.toEqual(provincias);
      expect(prisma.ubicacion.findMany).toHaveBeenCalledWith({
        where: { tipo: 'PROVINCIA' },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      });
    });
  });

  describe('getUnidades', () => {
    it('lanza 404 si la provincia no existe', async () => {
      const { service, prisma } = buildService();
      prisma.ubicacion.findFirst.mockResolvedValue(null);
      await expect(service.getUnidades('PROVINCIA:999')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('ordena municipios antes que distritos y alfabéticamente', async () => {
      const { service, prisma } = buildService();
      prisma.ubicacion.findFirst.mockResolvedValue({
        id: 'PROVINCIA:18',
        tipo: 'PROVINCIA',
      });
      prisma.ubicacion.findMany.mockResolvedValue([
        filaUbicacion(
          'DISTRITO_MUNICIPAL:9',
          'DISTRITO_MUNICIPAL',
          'Zona Rural',
          { municipioNombre: 'Tamboril' },
        ),
        filaUbicacion('MUNICIPIO:6', 'MUNICIPIO', 'Baitoa', {
          provinciaId: 'PROVINCIA:18',
        }),
        filaUbicacion('MUNICIPIO:5', 'MUNICIPIO', 'Tamboril', {
          provinciaId: 'PROVINCIA:18',
        }),
      ]);

      const unidades = await service.getUnidades('PROVINCIA:18');
      expect(unidades.map((u) => u.id)).toEqual([
        'MUNICIPIO:6',
        'MUNICIPIO:5',
        'DISTRITO_MUNICIPAL:9',
      ]);
    });
  });

  describe('getSectores', () => {
    it('lanza 404 si la unidad no existe', async () => {
      const { service, prisma } = buildService();
      prisma.ubicacion.findFirst.mockResolvedValue(null);
      await expect(service.getSectores('MUNICIPIO:999')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('filtra por tipo si se indica', async () => {
      const { service, prisma } = buildService();
      prisma.ubicacion.findFirst.mockResolvedValue({
        id: 'MUNICIPIO:5',
        tipo: 'MUNICIPIO',
      });
      prisma.ubicacion.findMany.mockResolvedValue([{ id: 'BARRIO:1' }]);
      const resultado = await service.getSectores(
        'MUNICIPIO:5',
        TipoUbicacion.BARRIO,
      );
      expect(resultado).toEqual([{ id: 'BARRIO:1' }]);
      expect(prisma.ubicacion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { unidadPadreId: 'MUNICIPIO:5', tipo: 'BARRIO' },
        }),
      );
    });
  });
});
