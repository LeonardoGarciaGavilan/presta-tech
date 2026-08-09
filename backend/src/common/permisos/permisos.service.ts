// src/common/permisos/permisos.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import {
  permisosBasePorRol,
  PERMISO_TODOS,
  MODULOS,
} from './permisos.constants';

const TTL = 60_000;

@Injectable()
export class PermisosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private clavePermisos(usuarioId: string, authVersion: number) {
    return `perm:efectivos:${usuarioId}:${authVersion}`;
  }

  private claveModulos(empresaId: string) {
    return `limites:modulos:${empresaId}`;
  }

  // ─── Módulos deshabilitados de una empresa (barrera 1) ──────────────────
  async modulosDeshabilitados(empresaId: string): Promise<string[]> {
    const key = this.claveModulos(empresaId);
    try {
      const cached = await this.cacheManager.get<string[]>(key);
      if (cached) return cached;
    } catch {
      // cache no disponible → seguir sin caché
    }

    let deshabilitados: string[] = [];
    try {
      const limite = await this.prisma.limiteEmpresa.findUnique({
        where: { empresaId },
        select: { modulosDeshabilitados: true, activo: true },
      });
      if (limite && !limite.activo) {
        // Plan desactivado → todos los módulos bloqueados (incluso ADMIN)
        deshabilitados = [...MODULOS];
      } else {
        deshabilitados = limite?.modulosDeshabilitados ?? [];
      }
    } catch (e) {
      console.warn('Error cargando modulosDeshabilitados:', e?.message);
      deshabilitados = [];
    }

    try {
      await this.cacheManager.set(key, deshabilitados, TTL);
    } catch {
      // cache no disponible → seguir sin caché
    }
    return deshabilitados;
  }

  async moduloHabilitado(empresaId: string, modulo: string): Promise<boolean> {
    const deshabilitados = await this.modulosDeshabilitados(empresaId);
    return !deshabilitados.includes(modulo);
  }

  // ─── Permisos efectivos de un usuario (barrera 2) ───────────────────────
  async permisosEfectivos(usuarioId: string): Promise<string[]> {
    let usuario: {
      rol: string;
      permisos: string[];
      permisosNegados: string[];
      authVersion: number;
      empresaId: string | null;
    } | null = null;
    try {
      usuario = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          rol: true,
          permisos: true,
          permisosNegados: true,
          authVersion: true,
          empresaId: true,
        },
      });
    } catch (e) {
      console.warn('Error cargando permisos del usuario:', e?.message);
      return [];
    }
    if (!usuario) return [];

    const key = this.clavePermisos(usuarioId, usuario.authVersion);
    try {
      const cached = await this.cacheManager.get<string[]>(key);
      if (cached) return cached;
    } catch {
      // cache no disponible → seguir sin caché
    }

    const otorgados = new Set<string>([
      ...permisosBasePorRol(usuario.rol),
      ...usuario.permisos,
    ]);
    for (const negado of usuario.permisosNegados) otorgados.delete(negado);

    let efectivos = [...otorgados];

    // Barrera 1: filtrar por módulos deshabilitados de la empresa
    if (usuario.empresaId) {
      const deshabilitados = await this.modulosDeshabilitados(
        usuario.empresaId,
      );
      if (deshabilitados.length > 0) {
        const esTodosLosModulos = deshabilitados.length === MODULOS.length;
        if (esTodosLosModulos) {
          efectivos = [];
        } else {
          efectivos = efectivos.filter((p) => {
            if (p === PERMISO_TODOS) return true;
            const modulo = p.split(':')[0];
            return !deshabilitados.includes(modulo);
          });
        }
      }
    }

    try {
      await this.cacheManager.set(key, efectivos, TTL);
    } catch {
      // cache no disponible → seguir sin caché
    }
    return efectivos;
  }

  async tienePermiso(usuarioId: string, permiso: string): Promise<boolean> {
    const efectivos = await this.permisosEfectivos(usuarioId);
    return efectivos.includes(PERMISO_TODOS) || efectivos.includes(permiso);
  }

  // ─── Invalidación de caché (al cambiar permisos/rol) ────────────────────
  async invalidarPermisos(usuarioId: string, authVersion: number) {
    try {
      await this.cacheManager.del(this.clavePermisos(usuarioId, authVersion));
    } catch {
      // cache no disponible → ignorar
    }
  }

  async invalidarModulos(empresaId: string) {
    try {
      await this.cacheManager.del(this.claveModulos(empresaId));
    } catch {
      // cache no disponible → ignorar
    }
  }
}
