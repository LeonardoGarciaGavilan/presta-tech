import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PrestamosService } from './prestamos.service';

@Injectable()
export class MoraCronService {
  private readonly logger = new Logger(MoraCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prestamosService: PrestamosService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON DIARIO DE ACTUALIZACIÓN DE MORA
  //
  // Horario:
  //   - Hora RD (AST / UTC-4):        2:00 AM
  //   - Hora UTC (Railway/servidor):   6:00 AM
  //
  // RD NO usa horario de verano (DST), por lo que UTC-4 es fijo todo el año.
  // La expresión '0 6 * * *' ejecuta a las 6:00 AM UTC = 2:00 AM AST.
  //
  // Comportamiento:
  //   - Itera todas las empresas activas secuencialmente
  //   - Cada empresa protegida con try/catch individual
  //   - Si una empresa falla, las demás continúan
  //   - Acumula estadísticas de procesamiento
  //   - Utiliza actualizarMoras() existente (no modifica su lógica)
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('0 6 * * *')
  async ejecutarActualizacionMora() {
    this.logger.log('=== INICIO CRON: Actualización de mora ===');

    // 1. Obtener todas las empresas activas
    const empresas = await this.prisma.empresa.findMany({
      where: { activa: true },
      select: { id: true, nombre: true },
    });

    this.logger.log(`Empresas activas encontradas: ${empresas.length}`);

    // 2. Procesar cada empresa secuencialmente
    let procesadas = 0;
    let fallidas = 0;

    for (const empresa of empresas) {
      try {
        this.logger.log(`Procesando empresa: ${empresa.nombre} (${empresa.id})`);

        const resultado = await this.prestamosService.actualizarMoras(empresa.id);

        this.logger.log(
          `Empresa ${empresa.nombre} completada: ${resultado.cuotasActualizadas ?? 0} cuotas con mora aplicada`,
        );

        procesadas++;
      } catch (error) {
        this.logger.error(
          `Error procesando empresa ${empresa.nombre} (${empresa.id}): ${error.message}`,
          error.stack,
        );

        fallidas++;
      }
    }

    // 3. Resumen final
    this.logger.log('=== FIN CRON: Actualización de mora ===');
    this.logger.log(`Total empresas: ${empresas.length}`);
    this.logger.log(`Procesadas: ${procesadas}`);
    this.logger.log(`Fallidas: ${fallidas}`);
  }
}
