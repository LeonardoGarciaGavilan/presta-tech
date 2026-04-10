// src/notificaciones/notificaciones.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calcularDesdeObjeto } from '../common/utils/prestamo.utils';

@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAlertas(user: any) {
    const hoy    = new Date();
    hoy.setHours(0, 0, 0, 0);

    const en2Dias = new Date(hoy);
    en2Dias.setDate(hoy.getDate() + 2);
    en2Dias.setHours(23, 59, 59, 999);

    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);

    // ── 1. Cuotas que vencen HOY ──────────────────────────────────────────
    const vencenHoy = await this.prisma.cuota.findMany({
      where: {
        pagada: false,
        fechaVencimiento: {
          gte: hoy,
          lte: new Date(new Date(hoy).setHours(23, 59, 59, 999)),
        },
        prestamo: { empresaId: user.empresaId, estado: { in: ['ACTIVO', 'ATRASADO'] } },
      },
      include: {
        prestamo: {
          select: {
            id: true,
            monto: true,
            cliente: { select: { nombre: true, apellido: true, telefono: true } },
          },
        },
      },
      orderBy: { fechaVencimiento: 'asc' },
    });

    // ── 2. Cuotas próximas (mañana y pasado mañana) ───────────────────────
    const proximasAVencer = await this.prisma.cuota.findMany({
      where: {
        pagada: false,
        fechaVencimiento: {
          gt: new Date(new Date(hoy).setHours(23, 59, 59, 999)),
          lte: en2Dias,
        },
        prestamo: { empresaId: user.empresaId, estado: { in: ['ACTIVO', 'ATRASADO'] } },
      },
      include: {
        prestamo: {
          select: {
            id: true,
            monto: true,
            cliente: { select: { nombre: true, apellido: true, telefono: true } },
          },
        },
      },
      orderBy: { fechaVencimiento: 'asc' },
    });

    // ── 3. Cuotas vencidas sin pagar ──────────────────────────────────────
    const vencidas = await this.prisma.cuota.findMany({
      where: {
        pagada: false,
        fechaVencimiento: { lt: hoy },
        prestamo: { empresaId: user.empresaId, estado: { in: ['ACTIVO', 'ATRASADO'] } },
      },
      include: {
        prestamo: {
          select: {
            id: true,
            monto: true,
            cliente: { select: { nombre: true, apellido: true, telefono: true } },
          },
        },
      },
      orderBy: { fechaVencimiento: 'asc' },
    });

    // ── 4. Préstamos en ATRASADO ──────────────────────────────────────────
    const atrasados = await this.prisma.prestamo.findMany({
      where: { empresaId: user.empresaId, estado: 'ATRASADO' },
      include: {
        cuotas: { where: { pagada: false } },
        cliente: { select: { nombre: true, apellido: true, telefono: true } },
      },
      orderBy: { moraAcumulada: 'desc' },
      take: 20,
    });

    // ── Mapear a formato uniforme ─────────────────────────────────────────
    const alertas = [
      ...vencenHoy.map((c) => ({
        tipo:       'HOY',
        prioridad:  1,
        prestamoId: c.prestamo.id,
        cliente:    `${c.prestamo.cliente.nombre} ${c.prestamo.cliente.apellido}`,
        telefono:   c.prestamo.cliente.telefono ?? '—',
        monto:      c.monto,
        fecha:      c.fechaVencimiento,
        mensaje:    'Cuota vence hoy',
      })),
      ...proximasAVencer.map((c) => {
        const diasRestantes = Math.ceil(
          (new Date(c.fechaVencimiento).getTime() - hoy.getTime()) / 86400000
        );
        return {
          tipo:       'PROXIMO',
          prioridad:  2,
          prestamoId: c.prestamo.id,
          cliente:    `${c.prestamo.cliente.nombre} ${c.prestamo.cliente.apellido}`,
          telefono:   c.prestamo.cliente.telefono ?? '—',
          monto:      c.monto,
          fecha:      c.fechaVencimiento,
          mensaje:    `Cuota vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`,
        };
      }),
      ...vencidas.map((c) => {
        const diasAtraso = Math.floor(
          (hoy.getTime() - new Date(c.fechaVencimiento).getTime()) / 86400000
        );
        return {
          tipo:       'VENCIDA',
          prioridad:  3,
          prestamoId: c.prestamo.id,
          cliente:    `${c.prestamo.cliente.nombre} ${c.prestamo.cliente.apellido}`,
          telefono:   c.prestamo.cliente.telefono ?? '—',
          monto:      c.monto,
          fecha:      c.fechaVencimiento,
          mensaje:    `Vencida hace ${diasAtraso} día${diasAtraso > 1 ? 's' : ''}`,
          diasAtraso,
        };
      }),
      ...atrasados.map((p) => {
        const { saldoPendiente, moraAcumulada } = calcularDesdeObjeto(p);
        return {
          tipo:       'ATRASADO',
          prioridad:  4,
          prestamoId: p.id,
          cliente:    `${p.cliente.nombre} ${p.cliente.apellido}`,
          telefono:   p.cliente.telefono ?? '—',
          monto:      moraAcumulada,
          saldo:      saldoPendiente,
          fecha:      null,
          mensaje:    'Préstamo en estado atrasado',
        };
      }),
    ];

    return {
      total:    alertas.length,
      urgentes: alertas.filter((a) => ['HOY', 'VENCIDA'].includes(a.tipo)).length,
      alertas,
      resumen: {
        vencenHoy:       vencenHoy.length,
        proximasAVencer: proximasAVencer.length,
        vencidas:        vencidas.length,
        atrasados:       atrasados.length,
      },
    };
  }
}