import { BadRequestException } from '@nestjs/common';

export interface ConfiguracionFinanciera {
  montoMinimoPrestamo: number;
  montoMaximoPrestamo: number | null;
  montoMaximoPago: number | null;
}

export class ConfiguracionUtils {
  static async getConfig(
    prisma: any,
    empresaId: string,
  ): Promise<ConfiguracionFinanciera> {
    const config = await prisma.configuracion.findUnique({
      where: { empresaId },
    });

    if (!config) {
      return {
        montoMinimoPrestamo: 500,
        montoMaximoPrestamo: null,
        montoMaximoPago: null,
      };
    }

    return {
      montoMinimoPrestamo: config.montoMinimoPrestamo ?? 500,
      montoMaximoPrestamo: config.montoMaximoPrestamo ?? null,
      montoMaximoPago: config.montoMaximoPago ?? null,
    };
  }

  static validarMontoMinimo(
    monto: number,
    montoMinimo: number,
    recurso: string,
  ): void {
    if (monto < montoMinimo) {
      throw new BadRequestException(
        `El ${recurso} mínimo permitido es $${montoMinimo.toLocaleString()}`,
      );
    }
  }

  static validarMontoMaximo(
    monto: number,
    montoMaximo: number | null,
    recurso: string,
  ): void {
    if (montoMaximo !== null && monto > montoMaximo) {
      throw new BadRequestException(
        `El ${recurso} máximo permitido es $${montoMaximo.toLocaleString()}`,
      );
    }
  }
}