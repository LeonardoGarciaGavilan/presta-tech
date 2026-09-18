import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { QuotaService } from '../common/quota/quota.service';
import { registrarAuditoria } from '../common/utils/auditoria.utils';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly quotaService: QuotaService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertExists(id: string, empresaId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, empresaId },
    });
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  private normalizarCedula(cedula: string): string {
    return cedula.replace(/[^0-9]/g, '');
  }

  private nombreCompleto(cliente: {
    nombre: string;
    apellido?: string | null;
  }) {
    return `${cliente.nombre} ${cliente.apellido ?? ''}`.trim();
  }

  private esCedulaDuplicada(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.some((t) => String(t).toLowerCase().includes('cedula'))
    );
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async create(createClienteDto: CreateClienteDto, empresaId: string) {
    const cuota = await this.quotaService.verificar(empresaId, 'clientes');
    const data: Prisma.ClienteCreateInput = {
      ...createClienteDto,
      cedula: this.normalizarCedula(createClienteDto.cedula),
      empresa: { connect: { id: empresaId } },
    };
    try {
      const cliente = await this.prisma.cliente.create({ data });
      if (cuota.advertencia) {
        return { ...cliente, advertenciaCuota: cuota };
      }
      return cliente;
    } catch (error) {
      if (this.esCedulaDuplicada(error)) {
        throw new ConflictException(
          `Ya existe un cliente con esta cédula en esta empresa. Verifique los datos o restrúyelo desde la lista de inactivos.`,
        );
      }
      throw error;
    }
  }

  async findAll(
    empresaId: string,
    pagina = 1,
    porPagina = 20,
    search = '',
    ids?: string[],
  ): Promise<PaginatedResult<any>> {
    const skip = (pagina - 1) * porPagina;
    const where: Prisma.ClienteWhereInput = { empresaId, activo: true };

    if (ids && ids.length > 0) {
      where.id = { in: ids };
    }

    if (search?.trim()) {
      const q = search.trim();
      const qSinGuiones = q.replace(/-/g, ''); // permite buscar "402-0001001-7" o "4020001001"
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { apellido: { contains: q, mode: 'insensitive' } },
        { cedula: { contains: qSinGuiones, mode: 'insensitive' } },
        { telefono: { contains: q, mode: 'insensitive' } },
        { provincia: { contains: q, mode: 'insensitive' } },
        { municipio: { contains: q, mode: 'insensitive' } },
      ];
      // Fila legacy con guiones en BD: "402-0001001-7" se busca también por su forma cruda
      if (qSinGuiones !== q) {
        where.OR.push({ cedula: { contains: q, mode: 'insensitive' } });
      }
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
    const where: Prisma.ClienteWhereInput = { empresaId, activo: false };

    if (search?.trim()) {
      const q = search.trim();
      const qSinGuiones = q.replace(/-/g, ''); // permite buscar "402-0001001-7" o "4020001001"
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { apellido: { contains: q, mode: 'insensitive' } },
        { cedula: { contains: qSinGuiones, mode: 'insensitive' } },
        { telefono: { contains: q, mode: 'insensitive' } },
        { provincia: { contains: q, mode: 'insensitive' } },
        { municipio: { contains: q, mode: 'insensitive' } },
      ];
      // Fila legacy con guiones en BD: "402-0001001-7" se busca también por su forma cruda
      if (qSinGuiones !== q) {
        where.OR.push({ cedula: { contains: q, mode: 'insensitive' } });
      }
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
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, empresaId },
      include: {
        prestamos: {
          include: {
            cuotas: {
              where: { pagada: false },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        garantias: {
          include: {
            cuotas: {
              where: { pagada: false },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        rutaClientes: {
          include: {
            ruta: true,
          },
        },
      },
    });
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async update(
    id: string,
    updateClienteDto: UpdateClienteDto,
    empresaId: string,
  ) {
    await this.assertExists(id, empresaId);
    const data: Prisma.ClienteUpdateInput = {
      ...updateClienteDto,
      ...(updateClienteDto.cedula
        ? { cedula: this.normalizarCedula(updateClienteDto.cedula) }
        : {}),
    };
    try {
      return await this.prisma.cliente.update({ where: { id }, data });
    } catch (error) {
      if (this.esCedulaDuplicada(error)) {
        throw new ConflictException(
          `Ya existe un cliente con esta cédula en esta empresa.`,
        );
      }
      throw error;
    }
  }

  async remove(id: string, empresaId: string, usuarioId?: string) {
    const anterior = await this.assertExists(id, empresaId);
    const cliente = await this.prisma.cliente.update({
      where: { id },
      data: { activo: false },
    });
    await registrarAuditoria(this.prisma, {
      empresaId,
      usuarioId,
      tipo: 'CLIENTE',
      accion: 'DESHABILITAR',
      descripcion: `Cliente ${this.nombreCompleto(cliente)} deshabilitado`,
      referenciaId: id,
      referenciaTipo: 'Cliente',
      datosAnteriores: {
        activo: anterior.activo,
        nombre: anterior.nombre,
        apellido: anterior.apellido,
        cedula: anterior.cedula,
      },
      datosNuevos: { activo: false },
    });
    return cliente;
  }

  async reactivar(id: string, empresaId: string, usuarioId?: string) {
    const anterior = await this.assertExists(id, empresaId);
    const cliente = await this.prisma.cliente.update({
      where: { id },
      data: { activo: true },
    });
    await registrarAuditoria(this.prisma, {
      empresaId,
      usuarioId,
      tipo: 'CLIENTE',
      accion: 'REACTIVAR',
      descripcion: `Cliente ${this.nombreCompleto(cliente)} reactivado`,
      referenciaId: id,
      referenciaTipo: 'Cliente',
      datosAnteriores: {
        activo: anterior.activo,
        nombre: anterior.nombre,
        apellido: anterior.apellido,
        cedula: anterior.cedula,
      },
      datosNuevos: { activo: true },
    });
    return cliente;
  }

  // ─── Documentos ─────────────────────────────────────────────────────────────

  async uploadCedula(
    clienteId: string,
    empresaId: string,
    tipo: 'cedula-frontal' | 'cedula-trasera',
    fileBuffer: Buffer,
    contentType: string,
  ) {
    await this.assertExists(clienteId, empresaId);

    const bucket = this.config.get<string>('supabase.bucket') ?? 'documentos';
    const path = this.supabase.buildClienteDocumentPath(
      empresaId,
      clienteId,
      tipo,
    );

    await this.supabase.uploadFile(bucket, path, fileBuffer, contentType);

    const fieldName =
      tipo === 'cedula-frontal' ? 'cedulaFrontalPath' : 'cedulaTraseraPath';
    await this.prisma.cliente.update({
      where: { id: clienteId },
      data: { [fieldName]: path },
    });

    const signed = await this.supabase.createSignedUrl(bucket, path);

    return {
      path,
      signedUrl: signed.signedUrl,
      expiresAt: signed.expiresAt,
    };
  }

  async getCedulaSignedUrl(
    clienteId: string,
    empresaId: string,
    tipo: 'cedula-frontal' | 'cedula-trasera',
  ) {
    const cliente = await this.assertExists(clienteId, empresaId);

    const path =
      tipo === 'cedula-frontal'
        ? cliente.cedulaFrontalPath
        : cliente.cedulaTraseraPath;
    if (!path) {
      throw new NotFoundException(`El cliente no tiene ${tipo} registrada`);
    }

    const bucket = this.config.get<string>('supabase.bucket') ?? 'documentos';
    return this.supabase.createSignedUrl(bucket, path);
  }
}
