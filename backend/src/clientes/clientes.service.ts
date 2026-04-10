import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertExists(id: string, empresaId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, empresaId },
    });
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async create(createClienteDto: CreateClienteDto, empresaId: string) {
    return this.prisma.cliente.create({
      data: { ...createClienteDto, empresaId },
    });
  }

  async findAll(
    empresaId: string,
    pagina = 1,
    porPagina = 20,
    search = '',
  ): Promise<PaginatedResult<any>> {
    const skip = (pagina - 1) * porPagina;
    const where: any = { empresaId, activo: true };

    if (search?.trim()) {
      const q = search.trim();
      const qSinGuiones = q.replace(/-/g, ''); // permite buscar "402-0001001-7" o "4020001001"
      where.OR = [
        { nombre:   { contains: q,           mode: 'insensitive' } },
        { apellido: { contains: q,           mode: 'insensitive' } },
        { cedula:   { contains: qSinGuiones, mode: 'insensitive' } },
        { telefono: { contains: q,           mode: 'insensitive' } },
        { provincia:{ contains: q,           mode: 'insensitive' } },
        { municipio:{ contains: q,           mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.cliente.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: porPagina,
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return {
      data,
      total,
      pagina,
      porPagina,
      totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    };
  }

  async findInactivos(
    empresaId: string,
    pagina = 1,
    porPagina = 20,
    search = '',
  ): Promise<PaginatedResult<any>> {
    const skip = (pagina - 1) * porPagina;
    const where: any = { empresaId, activo: false };

    if (search?.trim()) {
      const q = search.trim();
      const qSinGuiones = q.replace(/-/g, ''); // permite buscar "402-0001001-7" o "4020001001"
      where.OR = [
        { nombre:   { contains: q,           mode: 'insensitive' } },
        { apellido: { contains: q,           mode: 'insensitive' } },
        { cedula:   { contains: qSinGuiones, mode: 'insensitive' } },
        { telefono: { contains: q,           mode: 'insensitive' } },
        { provincia:{ contains: q,           mode: 'insensitive' } },
        { municipio:{ contains: q,           mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.cliente.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: porPagina,
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return {
      data,
      total,
      pagina,
      porPagina,
      totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    };
  }

  async findOne(id: string, empresaId: string) {
    return this.assertExists(id, empresaId);
  }

  async update(id: string, updateClienteDto: UpdateClienteDto, empresaId: string) {
    await this.assertExists(id, empresaId);
    return this.prisma.cliente.update({
      where: { id },
      data: updateClienteDto,
    });
  }

  async remove(id: string, empresaId: string) {
    await this.assertExists(id, empresaId);
    return this.prisma.cliente.update({
      where: { id },
      data: { activo: false },
    });
  }

  async reactivar(id: string, empresaId: string) {
    await this.assertExists(id, empresaId);
    return this.prisma.cliente.update({
      where: { id },
      data: { activo: true },
    });
  }
}