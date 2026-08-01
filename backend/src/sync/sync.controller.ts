// src/sync/sync.controller.ts
import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { registrarAuditoria } from '../common/utils/auditoria.utils';
import { ReportClearDto } from './dto/report-clear.dto';

interface AuthUser {
  userId: string;
  sub?: string;
  id?: string;
  rol?: string;
  empresaId?: string | null;
}

@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SyncController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra en auditoría la limpieza local de operaciones fallidas de la
   * cola offline. No elimina nada en el servidor: solo deja constancia
   * (usuario, empresa, cantidad y montos) del borrado en el dispositivo.
   */
  @Post('cola/limpiar')
  @Roles('SUPERADMIN', 'ADMIN', 'EMPLEADO')
  @HttpCode(HttpStatus.OK)
  async reportClear(
    @Body() dto: ReportClearDto,
    @Tenant() empresaId: string | null,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const items = dto.items ?? [];

    const montos = items
      .filter((i) => typeof i.monto === 'number')
      .map((i) => i.monto as number);
    const montoTotal = montos.reduce((sum, m) => sum + m, 0);

    const resumenEndpoints = items.reduce<Record<string, number>>((acc, i) => {
      const key = `${i.method} ${i.endpoint}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const xForwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : (xForwardedFor ?? req.ip ?? null);

    try {
      await registrarAuditoria(this.prisma, {
        empresaId,
        usuarioId: user.userId ?? user.sub ?? user.id,
        tipo: 'SYNC',
        accion: 'COLA_LIMPIADA',
        descripcion: `Limpieza de ${items.length} operaciones fallidas de la cola offline (monto total RD$${montoTotal.toLocaleString()}). Detalle: ${Object.entries(
          resumenEndpoints,
        )
          .map(([k, v]) => `${k} x${v}`)
          .join(', ')}`,
        monto: montoTotal || undefined,
        ip,
        userAgent: req.headers['user-agent'] ?? null,
        datosNuevos: {
          items,
          resumen: resumenEndpoints,
          total: items.length,
        },
        nivel: 'WARN',
      });
    } catch (error) {
      console.error('[Sync] Error al auditar limpieza de cola:', error);
      throw new HttpException(
        'No se pudo registrar la limpieza de la cola',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { ok: true };
  }
}
