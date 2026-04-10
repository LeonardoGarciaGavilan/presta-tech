
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
    // 1. Intentar desde caché
    const cached = await this.cacheManager.get(this.cacheKey(empresaId));
    if (cached) return cached;

    // 2. Si no hay caché, consultar BD
    const config = await this.prisma.configuracion.findUnique({
      where: { empresaId },
    });

    const result = config
      ? { 
          ...config, 
          existe: true,
          // Asegurar valores por defecto si existen pero son null
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

    // 3. Guardar en caché por 5 minutos (en ms para cache-manager v7)
    await this.cacheManager.set(this.cacheKey(empresaId), result, 300_000);
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

    // 🔄 Invalidar caché cuando se actualiza la configuración
    await this.cacheManager.del(this.cacheKey(empresaId));

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