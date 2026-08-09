// src/common/lockout/login-lockout.service.ts
// Lockout de login (F6) sobre el caché global (Keyv/Redis si está configurado,
// memoria como fallback). Reemplaza el Map en memoria de auth.service.
// Clave por `email:ip` → sobrevive restarts y multi-instancia.
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

const MAX_INTENTOS_FALLIDOS = 5;
const BLOQUEO_MINUTOS = 10;
const VENTANA_HORAS = 1;
const PREFIJO = 'lockout:';

interface IntentoLogin {
  intentos: number;
  bloqueadoHasta: number | null;
  primerIntento: number;
}

@Injectable()
export class LoginLockoutService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  private key(email: string, ip: string): string {
    return `${PREFIJO}${email.trim().toLowerCase()}:${ip}`;
  }

  async estaBloqueado(
    email: string,
    ip: string,
  ): Promise<{ bloqueado: boolean; minutosRestantes: number | null }> {
    const intento = await this.obtenerIntento(email, ip);
    if (!intento?.bloqueadoHasta) {
      return { bloqueado: false, minutosRestantes: null };
    }
    const restanteMs = intento.bloqueadoHasta - Date.now();
    if (restanteMs <= 0) {
      return { bloqueado: false, minutosRestantes: null };
    }
    return {
      bloqueado: true,
      minutosRestantes: Math.ceil(restanteMs / 60_000),
    };
  }

  async registrarIntentoFallido(email: string, ip: string): Promise<void> {
    const key = this.key(email, ip);
    const intento: IntentoLogin = (await this.obtenerIntento(email, ip)) ?? {
      intentos: 0,
      bloqueadoHasta: null,
      primerIntento: Date.now(),
    };

    intento.intentos += 1;
    if (intento.intentos >= MAX_INTENTOS_FALLIDOS) {
      intento.bloqueadoHasta = Date.now() + BLOQUEO_MINUTOS * 60_000;
    }

    // TTL = ventana completa (se limpia solo si la ventana expira)
    await this.cacheManager.set(
      key,
      JSON.stringify(intento),
      VENTANA_HORAS * 3600_000,
    );
  }

  async resetear(email: string, ip: string): Promise<void> {
    await this.cacheManager.del(this.key(email, ip));
  }

  private async obtenerIntento(
    email: string,
    ip: string,
  ): Promise<IntentoLogin | undefined> {
    const key = this.key(email, ip);
    const raw = await this.cacheManager.get<string>(key);
    if (!raw) return undefined;

    let intento: IntentoLogin;
    try {
      intento = JSON.parse(raw) as IntentoLogin;
    } catch {
      return undefined;
    }

    const ahora = Date.now();

    // Ventana expirada → limpiar
    if (ahora - intento.primerIntento >= VENTANA_HORAS * 3600_000) {
      await this.cacheManager.del(key);
      return undefined;
    }

    // Bloqueo terminado → limpiar
    if (intento.bloqueadoHasta && ahora >= intento.bloqueadoHasta) {
      await this.cacheManager.del(key);
      return undefined;
    }

    return intento;
  }
}
