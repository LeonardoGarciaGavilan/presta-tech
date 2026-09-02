//src/prisma/prisma.service.ts
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../common/tenant/tenant-context';
import { decidirPoliticaTenant } from '../common/tenant/tenant-policy';

const OPERACIONES_MULTI: ReadonlySet<string> = new Set([
  'findMany',
  'count',
  'updateMany',
  'deleteMany',
]);

function esDecimal(valor: unknown): valor is { toNumber: () => number } {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as any).toNumber === 'function' &&
    (valor as any).constructor?.name === 'Decimal'
  );
}

function convertirDecimales(valor: unknown): unknown {
  if (valor == null || typeof valor !== 'object') return valor;
  if (esDecimal(valor)) return valor.toNumber();
  if (valor instanceof Date) return valor;
  if (valor instanceof Uint8Array) return valor;
  if (Array.isArray(valor)) return valor.map((v) => convertirDecimales(v));
  for (const key of Object.keys(valor)) {
    (valor as Record<string, unknown>)[key] = convertirDecimales(
      (valor as Record<string, unknown>)[key],
    );
  }
  return valor;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly extended: PrismaClient;

  constructor(private readonly tenantContext: TenantContext) {
    super({
      transactionOptions: { maxWait: 5000, timeout: 15000 },
    });

    // Defensa multi-tenancy (F6): lee el contexto de empresa del request y
    // exige empresaId en queries multi-fila de modelos de negocio.
    const proteger = (
      modelo: string,
      operacion: string,
      args: any,
      query: any,
    ) => {
      if (!OPERACIONES_MULTI.has(operacion)) return query(args);

      const decision = decidirPoliticaTenant({
        modelo,
        operacion,
        where: args?.where,
        contexto: this.tenantContext.get(),
      });

      if (decision.accion === 'bloquear') {
        this.logger.error(`[tenant] Bloqueada: ${decision.motivo}`);
        throw new Error(
          `Consulta multi-tenant bloqueada: falta empresaId en where (${modelo}.${operacion})`,
        );
      }
      if (decision.accion === 'advertir') {
        this.logger.warn(`[tenant] Sin empresaId: ${decision.motivo}`);
      }

      return query(args);
    };

    this.extended = this.$extends({
      query: {
        $allModels: {
          $allOperations: async ({ model, operation, args, query }) => {
            const resultado = await proteger(model, operation, args, query);
            return convertirDecimales(resultado);
          },
        },
      },
    }) as unknown as PrismaClient;

    // Reemplazar métodos del cliente base por los del cliente extendido:
    // los servicios siguen usando `this.prisma.<modelo>` y pasan por el guard.
    Object.assign(this, this.extended as unknown as PrismaClient);
  }

  async onModuleInit() {
    await this.extended.$connect();
    console.log('✅ Conectado a la base de datos');
  }

  async onModuleDestroy() {
    await this.extended.$disconnect();
  }
}
