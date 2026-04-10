// src/rutas/rutas.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calcularDesdeObjeto } from '../common/utils/prestamo.utils';

const CLIENTE_SELECT = {
  id: true, nombre: true, apellido: true, cedula: true,
  telefono: true, celular: true, direccion: true, sector: true,
  municipio: true, provincia: true, observaciones: true,
  latitud: true, longitud: true, coordsAproximadas: true,
} as const;

@Injectable()
export class RutasService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helper ───────────────────────────────────────────────────────────────
  private async assertRuta(rutaId: string, empresaId: string, usuarioId: string, isAdmin: boolean) {
    const ruta = await this.prisma.ruta.findFirst({ where: { id: rutaId, empresaId } });
    if (!ruta) throw new NotFoundException('Ruta no encontrada');
    if (!isAdmin && ruta.usuarioId !== usuarioId)
      throw new ForbiddenException('No tienes permiso para modificar esta ruta');
    return ruta;
  }

  // ─── 1. LISTAR RUTAS ─────────────────────────────────────────────────────
  async findAll(empresaId: string, usuarioId: string, isAdmin: boolean) {
    return this.prisma.ruta.findMany({
      where: { empresaId, ...(!isAdmin && { usuarioId }), activa: true },
      include: {
        usuario: { select: { id: true, nombre: true } },
        clientes: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── 2. CREAR RUTA ────────────────────────────────────────────────────────
  async create(empresaId: string, usuarioId: string, nombre: string, descripcion?: string) {
    return this.prisma.ruta.create({
      data: { nombre, descripcion, empresaId, usuarioId },
      include: { usuario: { select: { id: true, nombre: true } } },
    });
  }

  // ─── 3. ACTUALIZAR RUTA ───────────────────────────────────────────────────
  async update(rutaId: string, empresaId: string, usuarioId: string, isAdmin: boolean,
    data: { nombre?: string; descripcion?: string; activa?: boolean }) {
    await this.assertRuta(rutaId, empresaId, usuarioId, isAdmin);
    return this.prisma.ruta.update({ where: { id: rutaId }, data });
  }

  // ─── 4. ELIMINAR RUTA (soft delete) ──────────────────────────────────────
  async remove(rutaId: string, empresaId: string, usuarioId: string, isAdmin: boolean) {
    await this.assertRuta(rutaId, empresaId, usuarioId, isAdmin);
    return this.prisma.ruta.update({ where: { id: rutaId }, data: { activa: false } });
  }

  // ─── 5. AGREGAR CLIENTE A RUTA ────────────────────────────────────────────
  async agregarCliente(rutaId: string, empresaId: string, usuarioId: string,
    isAdmin: boolean, clienteId: string, observacion?: string) {
    await this.assertRuta(rutaId, empresaId, usuarioId, isAdmin);
    const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, empresaId, activo: true } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    const count = await this.prisma.rutaCliente.count({ where: { rutaId } });
    try {
      return await this.prisma.rutaCliente.create({
        data: { rutaId, clienteId, observacion, orden: count + 1 },
        include: { cliente: { select: CLIENTE_SELECT } },
      });
    } catch {
      throw new BadRequestException('El cliente ya está en esta ruta');
    }
  }

  // ─── 6. ACTUALIZAR CLIENTE EN RUTA ───────────────────────────────────────
  async actualizarCliente(rutaId: string, rutaClienteId: string, empresaId: string,
    usuarioId: string, isAdmin: boolean, data: { observacion?: string; orden?: number }) {
    await this.assertRuta(rutaId, empresaId, usuarioId, isAdmin);
    return this.prisma.rutaCliente.update({ where: { id: rutaClienteId }, data });
  }

  // ─── 7. QUITAR CLIENTE DE RUTA ────────────────────────────────────────────
  async quitarCliente(rutaId: string, rutaClienteId: string, empresaId: string,
    usuarioId: string, isAdmin: boolean) {
    await this.assertRuta(rutaId, empresaId, usuarioId, isAdmin);
    return this.prisma.rutaCliente.delete({ where: { id: rutaClienteId } });
  }

  // ─── 8. REORDENAR CLIENTES ────────────────────────────────────────────────
  async reordenar(rutaId: string, empresaId: string, usuarioId: string,
    isAdmin: boolean, orden: { id: string; orden: number }[]) {
    await this.assertRuta(rutaId, empresaId, usuarioId, isAdmin);
    await Promise.all(orden.map(item =>
      this.prisma.rutaCliente.update({ where: { id: item.id }, data: { orden: item.orden } })
    ));
    return { ok: true };
  }

  // ─── 9. VISTA DEL DÍA ────────────────────────────────────────────────────
  async vistaDia(rutaId: string, empresaId: string, usuarioId: string,
    isAdmin: boolean, fecha?: string) {
    await this.assertRuta(rutaId, empresaId, usuarioId, isAdmin);

    const hoy    = fecha ? new Date(`${fecha}T00:00:00`) : new Date();
    const finDia = fecha ? new Date(`${fecha}T23:59:59.999`) : new Date();
    if (!fecha) { hoy.setHours(0, 0, 0, 0); finDia.setHours(23, 59, 59, 999); }

    const fechaStr = fecha ?? hoy.toISOString().slice(0, 10);

    // Solo clientes con fechaRuta del día seleccionado (sub-ruta del día)
    // Si no hay sub-ruta generada para ese día, devuelve todos
    const tieneSubRuta = await this.prisma.rutaCliente.count({
      where: { rutaId, fechaRuta: fechaStr },
    });

    // ============================================================
    // OPTIMIZACIÓN: Eliminar N+1
    // Antigua versión: Promise.all + findMany por cada cliente
    // Nueva versión: 2 queries (no N+1)
    //   1. Obtener clientes de la ruta
    //   2. Obtener TODOS los préstamos en UNA sola query
    // ============================================================
    
    const rutaClientes = await this.prisma.rutaCliente.findMany({
      where: { rutaId, ...(tieneSubRuta > 0 ? { fechaRuta: fechaStr } : {}) },
      orderBy: { orden: 'asc' },
      include: { cliente: { select: CLIENTE_SELECT } },
    });

    // Obtener IDs de clientes para batch query
    const clienteIds = rutaClientes.map(rc => rc.clienteId);

    // UNA sola query para TODOS los préstamos de estos clientes
    const prestamosMap = new Map();
    if (clienteIds.length > 0) {
      const todosPrestamos = await this.prisma.prestamo.findMany({
        where: {
          clienteId: { in: clienteIds },
          empresaId,
          estado: { in: ['ACTIVO', 'ATRASADO'] },
        },
        include: {
          cuotas: { where: { pagada: false }, orderBy: { numero: 'asc' } },
        },
      });

      // Agrupar por clienteId para acceso O(1)
      for (const p of todosPrestamos) {
        const existing = prestamosMap.get(p.clienteId) || [];
        existing.push(p);
        prestamosMap.set(p.clienteId, existing);
      }
    }

    // Procesar los datos (rápido, sin queries adicionales)
    const resultado = rutaClientes.map((rc) => {
      const prestamos = prestamosMap.get(rc.clienteId) || [];
      
      const cuotasAVencer = prestamos.flatMap((p: any) =>
        p.cuotas
          .filter((c: any) => new Date(c.fechaVencimiento) <= finDia)
          .map((c: any) => ({
            prestamoId: p.id, cuotaId: c.id, numero: c.numero,
            monto: c.monto, mora: c.mora, total: c.monto + (c.mora || 0),
            fechaVencimiento: c.fechaVencimiento,
            vencida: new Date(c.fechaVencimiento) < hoy,
            frecuencia: p.frecuenciaPago,
          }))
      );

      const totalACobrar   = cuotasAVencer.reduce((s: number, c: any) => s + c.total, 0);
      const tieneAtrasados = prestamos.some((p: any) => p.estado === 'ATRASADO');
      const tienePrestamos = prestamos.length > 0;

      return {
        rutaClienteId: rc.id, orden: rc.orden, observacion: rc.observacion,
        visitadoHoy: rc.visitadoHoy, ultimaVisita: rc.ultimaVisita,
        cliente: rc.cliente,
        prestamos: prestamos.map((p: any) => {
          const { saldoPendiente } = calcularDesdeObjeto(p);
          return {
            id: p.id, monto: p.monto, saldo: saldoPendiente,
            estado: p.estado, frecuencia: p.frecuenciaPago,
            cuotasPendientes: p.cuotas.length,
            proximaCuota: p.cuotas[0] ?? null,
          };
        }),
        cuotasAVencer,
        totalACobrar: Math.round(totalACobrar * 100) / 100,
        tieneAtrasados, tienePrestamos,
        debeVisitar: cuotasAVencer.length > 0 || tieneAtrasados,
      };
    });

    const totalRuta    = resultado.reduce((s, r) => s + r.totalACobrar, 0);
    const aVisitar     = resultado.filter(r => r.debeVisitar);
    const visitados    = resultado.filter(r => r.visitadoHoy);
    const conAtrasados = resultado.filter(r => r.tieneAtrasados);

    return {
      rutaId, fecha: fechaStr, esSubRuta: tieneSubRuta > 0,
      resumen: {
        totalClientes: resultado.length,
        aVisitarHoy: aVisitar.length,
        visitadosHoy: visitados.length,
        conAtrasados: conAtrasados.length,
        totalACobrarHoy: Math.round(totalRuta * 100) / 100,
      },
      clientes: resultado,
    };
  }

  // ─── 10. MARCAR / DESMARCAR VISITADO ─────────────────────────────────────
  async marcarVisitado(rutaClienteId: string, empresaId: string, usuarioId: string, visitado: boolean) {
    const rc = await this.prisma.rutaCliente.findFirst({
      where: { id: rutaClienteId }, include: { ruta: true },
    });
    if (!rc || rc.ruta.empresaId !== empresaId) throw new NotFoundException('No encontrado');
    return this.prisma.rutaCliente.update({
      where: { id: rutaClienteId },
      data: { visitadoHoy: visitado, ultimaVisita: visitado ? new Date() : rc.ultimaVisita },
    });
  }

  // ─── 11. RESET VISITADOS ─────────────────────────────────────────────────
  async resetVisitados(empresaId: string) {
    await this.prisma.rutaCliente.updateMany({
      where: { ruta: { empresaId } }, data: { visitadoHoy: false },
    });
    return { ok: true };
  }

  // ─── 12. DETALLE COMPLETO DE UNA RUTA ────────────────────────────────────
  async findOne(rutaId: string, empresaId: string, usuarioId: string, isAdmin: boolean) {
    await this.assertRuta(rutaId, empresaId, usuarioId, isAdmin);
    return this.prisma.ruta.findFirst({
      where: { id: rutaId, empresaId },
      include: {
        usuario: { select: { id: true, nombre: true } },
        clientes: {
          orderBy: { orden: 'asc' },
          include: { cliente: { select: CLIENTE_SELECT } },
        },
      },
    });
  }

  // ─── 13. ASIGNAR USUARIO/COBRADOR A RUTA (admin) ─────────────────────────
  async asignarUsuario(rutaId: string, empresaId: string, nuevoUsuarioId: string) {
    const ruta = await this.prisma.ruta.findFirst({ where: { id: rutaId, empresaId } });
    if (!ruta) throw new NotFoundException('Ruta no encontrada');

    const usuario = await this.prisma.usuario.findFirst({
      where: { id: nuevoUsuarioId, empresaId, activo: true },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    return this.prisma.ruta.update({
      where: { id: rutaId },
      data: { usuarioId: nuevoUsuarioId },
      include: { usuario: { select: { id: true, nombre: true } } },
    });
  }

  // ─── 14. LISTAR USUARIOS DE LA EMPRESA (para selector del admin) ──────────
  async getUsuariosEmpresa(empresaId: string) {
    return this.prisma.usuario.findMany({
      where: { empresaId, activo: true },
      select: { id: true, nombre: true, email: true, rol: true },
      orderBy: { nombre: 'asc' },
    });
  }

  // ─── 15. GENERAR SUB-RUTA DEL DÍA ────────────────────────────────────────
  // Marca un conjunto de rutaClienteIds con fechaRuta para el día dado
  async generarRutaDia(rutaId: string, empresaId: string, usuarioId: string,
    isAdmin: boolean, rutaClienteIds: string[], fecha: string) {
    await this.assertRuta(rutaId, empresaId, usuarioId, isAdmin);

    // Limpiar selección anterior del mismo día
    await this.prisma.rutaCliente.updateMany({
      where: { rutaId, fechaRuta: fecha },
      data: { fechaRuta: null },
    });

    // Marcar los seleccionados
    await this.prisma.rutaCliente.updateMany({
      where: { id: { in: rutaClienteIds }, rutaId },
      data: { fechaRuta: fecha },
    });

    return { ok: true, total: rutaClienteIds.length, fecha };
  }

  // ─── 16. RUTA ACTUAL DE UN CLIENTE ───────────────────────────────────────
  async getRutaDeCliente(clienteId: string, empresaId: string) {
    const rc = await this.prisma.rutaCliente.findFirst({
      where: { clienteId, ruta: { empresaId, activa: true } },
      include: { ruta: { select: { id: true, nombre: true } } },
    });
    return rc ? { rutaClienteId: rc.id, rutaId: rc.ruta.id, rutaNombre: rc.ruta.nombre } : null;
  }

  // ─── 17. ASIGNAR/CAMBIAR RUTA DE UN CLIENTE ──────────────────────────────
  async asignarRuta(clienteId: string, empresaId: string, rutaId: string | null) {
    const actual = await this.prisma.rutaCliente.findFirst({
      where: { clienteId, ruta: { empresaId, activa: true } },
    });
    if (actual) await this.prisma.rutaCliente.delete({ where: { id: actual.id } });
    if (!rutaId) return { ok: true, rutaId: null };

    const ruta = await this.prisma.ruta.findFirst({ where: { id: rutaId, empresaId, activa: true } });
    if (!ruta) throw new NotFoundException('Ruta no encontrada');

    const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, empresaId, activo: true } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    const count = await this.prisma.rutaCliente.count({ where: { rutaId } });
    const rc = await this.prisma.rutaCliente.create({
      data: { rutaId, clienteId, orden: count + 1 },
      include: { ruta: { select: { id: true, nombre: true } } },
    });
    return { ok: true, rutaId: rc.ruta.id, rutaNombre: rc.ruta.nombre };
  }
}