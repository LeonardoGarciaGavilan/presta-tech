
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertConfiguracionDto } from './dto/upsert-configuracion.dto';
import { registrarAuditoria, generarDescripcionCambios } from '../common/utils/auditoria.utils';

@Injectable()
export class ConfiguracionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private cacheKey(empresaId: string) {
    return `config:${empresaId}`;
  }

  async findOne(empresaId: string) {
    const cacheKey = this.cacheKey(empresaId);

    // 1. Intentar leer desde caché (NO bloqueante)
    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) return cached;
    } catch (e) {
      console.warn('Cache read error:', e?.message);
    }

    // 2. Consultar BD
    const config = await this.prisma.configuracion.findUnique({
      where: { empresaId },
    });

    const result = config
      ? { 
          ...config, 
          existe: true,
          montoMinimoPrestamo: config.montoMinimoPrestamo ?? 500,
          montoMaximoPrestamo: config.montoMaximoPrestamo ?? null,
          montoMaximoPago: config.montoMaximoPago ?? null,
        }
      : {
          tasaInteresBase: 0,
          moraPorcentajeMensual: 0,
          diasGracia: 5,
          permitirAbonoCapital: true,
          montoMinimoPrestamo: 500,
          montoMaximoPrestamo: null,
          montoMaximoPago: null,
          empresaId,
          existe: false,
        };

    // 3. Intentar guardar en caché (NO bloqueante)
    try {
      await this.cacheManager.set(cacheKey, result, 300_000);
    } catch (e) {
      console.warn('Cache write error:', e?.message);
    }

    return result;
  }

  async upsert(dto: UpsertConfiguracionDto, empresaId: string, usuarioId?: string) {
    const configAnterior = await this.prisma.configuracion.findUnique({ where: { empresaId } });
    const esCreacion = !configAnterior;

    const datosAnteriores = configAnterior ? {
      tasaInteresBase: configAnterior.tasaInteresBase,
      moraPorcentajeMensual: configAnterior.moraPorcentajeMensual,
      diasGracia: configAnterior.diasGracia,
      permitirAbonoCapital: configAnterior.permitirAbonoCapital,
      montoMinimoPrestamo: configAnterior.montoMinimoPrestamo,
      montoMaximoPrestamo: configAnterior.montoMaximoPrestamo,
      montoMaximoPago: configAnterior.montoMaximoPago,
    } : null;

    const datosNuevos = {
      tasaInteresBase: dto.tasaInteresBase,
      moraPorcentajeMensual: dto.moraPorcentajeMensual,
      diasGracia: dto.diasGracia,
      permitirAbonoCapital: dto.permitirAbonoCapital,
      montoMinimoPrestamo: dto.montoMinimoPrestamo ?? 500,
      montoMaximoPrestamo: dto.montoMaximoPrestamo,
      montoMaximoPago: dto.montoMaximoPago,
    };

    const descripcion = esCreacion 
      ? `Configuración creada: Tasa ${dto.tasaInteresBase}%, Mora ${dto.moraPorcentajeMensual}%`
      : generarDescripcionCambios(datosAnteriores, datosNuevos);

    const result = await this.prisma.configuracion.upsert({
      where: { empresaId },
      update: datosNuevos,
      create: { ...datosNuevos, empresaId },
    });

    // 🔄 Invalidar caché cuando se actualiza la configuración (NO bloqueante)
    try {
      await this.cacheManager.del(this.cacheKey(empresaId));
    } catch (e) {
      console.warn('Cache delete error:', e?.message);
    }

    await registrarAuditoria(this.prisma, {
      empresaId,
      usuarioId,
      tipo: 'CONFIGURACION',
      accion: esCreacion ? 'CREATE' : 'UPDATE',
      descripcion,
      referenciaId: empresaId,
      referenciaTipo: 'Configuracion',
      datosAnteriores,
      datosNuevos,
    });

    return result;
  }
}