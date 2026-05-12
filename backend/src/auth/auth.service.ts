// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { randomBytes } from 'crypto';
import { Response } from 'express';
import { registrarAuditoria } from '../common/utils/auditoria.utils';

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
const TOKEN_REUSE_GRACE_MS = 10_000;

const MAX_INTENTOS_FALLIDOS = 5;
const BLOQUEO_MINUTOS = 10;
const VENTANA_HORAS = 1;

interface IntentoLogin {
  intentos: number;
  bloqueadoHasta: Date | null;
  primerIntento: Date;
}

@Injectable()
export class AuthService {
  private intentosLogin = new Map<string, IntentoLogin>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILIDADES DE TOKEN
  // ═══════════════════════════════════════════════════════════════════════════

  private generateRefreshToken(): string {
    return randomBytes(64).toString('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiry(): Date {
    return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COOKIES
  // ═══════════════════════════════════════════════════════════════════════════

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setRefreshTokenCookie(res: Response, token: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clearRefreshTokenCookie(res: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOQUEO DE IP POR INTENTOS FALLIDOS
  // ═══════════════════════════════════════════════════════════════════════════

  private obtenerIntento(ip: string): IntentoLogin | undefined {
    const intento = this.intentosLogin.get(ip);
    
    if (!intento) return undefined;

    const ahora = new Date();
    const horasDesdePrimerIntento = (ahora.getTime() - intento.primerIntento.getTime()) / (1000 * 60 * 60);

    if (horasDesdePrimerIntento >= VENTANA_HORAS) {
      this.intentosLogin.delete(ip);
      return undefined;
    }

    if (intento.bloqueadoHasta && ahora >= intento.bloqueadoHasta) {
      this.intentosLogin.delete(ip);
      return undefined;
    }

    return intento;
  }

  private estaBloqueada(ip: string): boolean {
    const intento = this.obtenerIntento(ip);
    if (!intento) return false;
    
    if (intento.bloqueadoHasta) {
      return new Date() < intento.bloqueadoHasta;
    }
    
    return false;
  }

  private getMinutosRestantes(ip: string): number | null {
    const intento = this.obtenerIntento(ip);
    if (!intento || !intento.bloqueadoHasta) return null;
    
    const minutosRestantes = Math.ceil(
      (intento.bloqueadoHasta.getTime() - Date.now()) / 60000
    );
    
    return minutosRestantes > 0 ? minutosRestantes : null;
  }

  private registrarIntentoFallido(ip: string): void {
    const intento = this.obtenerIntento(ip) || {
      intentos: 0,
      bloqueadoHasta: null,
      primerIntento: new Date(),
    };

    intento.intentos += 1;

    if (intento.intentos >= MAX_INTENTOS_FALLIDOS) {
      intento.bloqueadoHasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000);
    }

    this.intentosLogin.set(ip, intento);
  }

  private resetearIntentos(ip: string): void {
    this.intentosLogin.delete(ip);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDACIÓN DE USUARIO
  // ═══════════════════════════════════════════════════════════════════════════

  async validateUser(email: string, password: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { email },
      include: { empresa: true },
    });

    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Credenciales inválidas');

    if (!user.activo) {
      throw new UnauthorizedException(
        'Tu cuenta ha sido desactivada. Contacta al administrador.',
      );
    }

    return user;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async login(email: string, password: string, ip: string, userAgent?: string, res?: any) {
    // ─── VERIFICAR SI IP ESTÁ BLOQUEADA ───
    if (this.estaBloqueada(ip)) {
      const minutosRestantes = this.getMinutosRestantes(ip);
      
      // Registrar intento bloqueado
      await registrarAuditoria(this.prisma, {
        empresaId: 'sistema',
        tipo: 'AUTH',
        accion: 'LOGIN_BLOCKED',
        descripcion: `IP ${ip} bloqueada tras múltiples intentos fallidos. Minutos restantes: ${minutosRestantes}`,
        ip,
        userAgent,
        nivel: 'WARN',
      });

      throw new ForbiddenException({
        message: 'Demasiados intentos. Intente más tarde.',
        minutosRestantes,
      });
    }

    // ─── INTENTAR LOGIN ───
    let user;
    try {
      user = await this.validateUser(email, password);
    } catch (error) {
      // Login fallido → registrar intento
      if (error instanceof UnauthorizedException) {
        this.registrarIntentoFallido(ip);

        // Auditoría de login fallido
        await registrarAuditoria(this.prisma, {
          empresaId: user?.empresaId ?? 'sistema',
          usuarioId: user?.id,
          tipo: 'AUTH',
          accion: 'LOGIN_FAILED',
          descripcion: `Credenciales inválidas para usuario ${email}`,
          ip,
          userAgent,
          nivel: 'WARN',
        });
      }
      throw error;
    }

    // Login exitoso → resetear contador de intentos
    this.resetearIntentos(ip);

    // Auditoría de login exitoso
    await registrarAuditoria(this.prisma, {
      empresaId: user.empresaId ?? 'sistema',
      usuarioId: user.id,
      tipo: 'AUTH',
      accion: 'LOGIN_SUCCESS',
      descripcion: `Usuario ${user.email} inició sesión correctamente`,
      ip,
      userAgent,
      nivel: 'INFO',
    });

    // Pruning: eliminar tokens expirados antes de crear nuevo
    await this.cleanupExpiredTokens(user.id);

    const payload = {
      sub:       user.id,
      userId:    user.id,
      email:     user.email,
      nombre:    user.nombre,
      rol:       user.rol,
      empresaId: user.empresaId ?? null,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = this.generateRefreshToken();
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        usuarioId: user.id,
        tokenHash,
        expiresAt: this.getRefreshTokenExpiry(),
      },
    });

    const usuarioResponse = {
      id:        user.id,
      email:     user.email,
      nombre:    user.nombre,
      rol:       user.rol,
      empresa:   user.empresa?.nombre || null,
      empresaId: user.empresaId,
    };

    if (res) {
      this.setRefreshTokenCookie(res, refreshToken);
    }

    // ── SUPERADMIN — sesión normal, no requiere empresa ───────────────────
    if (user.rol === 'SUPERADMIN') {
      return {
        access_token: accessToken,
        esSuperAdmin: true,
        usuario:      usuarioResponse,
      };
    }

    // ── Cambio de password obligatorio ───────────────────────────────────
    if (user.debeCambiarPassword) {
      const tokenTemporal = this.jwtService.sign(
        { ...payload, cambioPassword: true },
        { expiresIn: '15m' },
      );
      return {
        access_token: tokenTemporal,
        requiereCambioPassword: true,
        mensaje:                'Debe cambiar su contraseña antes de continuar',
        usuario:                usuarioResponse,
      };
    }

    // ── Login normal ──────────────────────────────────────────────────────
    return {
      access_token: accessToken,
      usuario: usuarioResponse,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REFRESH CON ROTACIÓN OBLIGATORIA
  // ═══════════════════════════════════════════════════════════════════════════

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async refresh(refreshToken: string | undefined, res: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException('Token de refresh no proporcionado');
    }

    const tokenHash = this.hashToken(refreshToken);
    
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { usuario: { include: { empresa: true } } },
    });

    // Validación: token existe
    if (!storedToken) {
      throw new UnauthorizedException('Token inválido');
    }

    // Validación: token no ha sido revocado
    if (storedToken.revoked || storedToken.revokedAt) {
      if (storedToken.revokedAt && Date.now() - storedToken.revokedAt.getTime() < TOKEN_REUSE_GRACE_MS) {
        // ⚡ Race condition: el token se rotó hace <10s (F5 durante refresh, tabs múltiples)
        // En vez de invalidar todo, emitimos tokens nuevos normalmente
        // El rotate subsecuente revocará este intento de reuso benigno
        await registrarAuditoria(this.prisma, {
          empresaId: storedToken.usuario?.empresaId ?? 'sistema',
          usuarioId: storedToken.usuarioId,
          tipo: 'AUTH',
          accion: 'TOKEN_REUSE_GRACE',
          descripcion: `Race condition en refresh token (${Math.round((Date.now() - storedToken.revokedAt.getTime()) / 1000)}s desde revocación)`,
          nivel: 'WARN',
        });
      } else {
        // 🚨 SECURITY: Token revocado hace tiempo - posible robo de token
        await this.handleTokenReuse(storedToken.usuarioId);
        throw new UnauthorizedException('Sesión comprometida. Por favor inicia sesión nuevamente.');
      }
    }

    // Validación: token no ha expirado
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Token expirado');
    }

    // Validación: usuario activo
    if (!storedToken.usuario.activo) {
      await this.revokeToken(storedToken.id);
      throw new ForbiddenException('Usuario inactivo. Contacte al administrador.');
    }

    // 🚨 ROTACIÓN OBLIGATORIA: Revocar el token usado
    await this.revokeToken(storedToken.id, 'ROTATION');

    // Generar nuevo refresh token
    const newRefreshToken = this.generateRefreshToken();
    const newTokenHash = this.hashToken(newRefreshToken);

    await this.prisma.refreshToken.create({
      data: {
        usuarioId: storedToken.usuarioId,
        tokenHash: newTokenHash,
        expiresAt: this.getRefreshTokenExpiry(),
      },
    });

    // Generar nuevo access token
    const payload = {
      sub:       storedToken.usuario.id,
      userId:    storedToken.usuario.id,
      email:     storedToken.usuario.email,
      nombre:    storedToken.usuario.nombre,
      rol:       storedToken.usuario.rol,
      empresaId: storedToken.usuario.empresaId ?? null,
    };

    const newAccessToken = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });

    // Set cookie con nuevo refresh token
    this.setRefreshTokenCookie(res, newRefreshToken);

    return { access_token: newAccessToken };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════════════════

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async logout(refreshToken: string | undefined, res?: any, userId?: string, empresaId?: string, ip?: string, userAgent?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (storedToken && !storedToken.revoked) {
        await this.revokeToken(storedToken.id, 'USER_LOGOUT');
      }
    }

    // Auditoría de logout
    if (userId && empresaId) {
      await registrarAuditoria(this.prisma, {
        empresaId,
        usuarioId: userId,
        tipo: 'AUTH',
        accion: 'LOGOUT',
        descripcion: 'Usuario cerró sesión',
        ip,
        userAgent,
        nivel: 'INFO',
      });
    }

    if (res) {
      this.clearRefreshTokenCookie(res);
    }

    return { message: 'Sesión cerrada correctamente' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGOUT ALL (cerrar todas las sesiones)
  // ═══════════════════════════════════════════════════════════════════════════

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        usuarioId: userId,
        revoked: false,
      },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: 'USER_LOGOUT_ALL',
      },
    });

    return { message: 'Todas las sesiones han sido cerradas' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MANEJO DE REUSE DE TOKEN
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleTokenReuse(userId: string) {
    // Revocar TODAS las sesiones del usuario
    await this.prisma.refreshToken.updateMany({
      where: {
        usuarioId: userId,
        revoked: false,
      },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: 'TOKEN_REUSE_DETECTED',
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIMPIEZA DE TOKENS EXPIRADOS
  // ═══════════════════════════════════════════════════════════════════════════

  async cleanupExpiredTokens(userId?: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Eliminar tokens expirados o revocados antiguos
    await this.prisma.refreshToken.deleteMany({
      where: userId ? {
        usuarioId: userId,
        OR: [
          { expiresAt: { lt: new Date() } },
          { revoked: true, revokedAt: { lt: thirtyDaysAgo } },
        ],
      } : {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revoked: true, revokedAt: { lt: thirtyDaysAgo } },
        ],
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REVOCAR TOKEN ESPECÍFICO
  // ═══════════════════════════════════════════════════════════════════════════

  private async revokeToken(tokenId: string, reason?: string) {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET CURRENT USER
  // ═══════════════════════════════════════════════════════════════════════════

  async getCurrentUser(userId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: { empresa: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.activo) {
      throw new UnauthorizedException('Cuenta desactivada');
    }

    return {
      id:      user.id,
      email:   user.email,
      nombre:  user.nombre,
      rol:     user.rol,
      empresa: user.empresa?.nombre || null,
      empresaId: user.empresaId,
    };
  }
}
