// src/auth/auth.controller.ts
import { Controller, Post, Body, Get, Request, Res, UseGuards, Req } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { registrarAuditoria } from '../common/utils/auditoria.utils';

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  // Rate limiting: 10 intentos por 5 minutos
  @Throttle({ login: { limit: 10, ttl: 300_000 } })
  @Post('login')
  login(
    @Body() body: { email: string; password: string },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Req() req: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Res({ passthrough: true }) res: any,
  ) {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown';
    
    const userAgent = req.headers['user-agent'] || null;
    
    return this.authService.login(body.email, body.password, ip, userAgent, res);
  }

  // Rate limiting: 100 requests por minuto
  @Throttle({ refresh: { limit: 100, ttl: 60_000 } })
  @Post('refresh')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refresh(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const refreshToken = req.cookies?.refresh_token;
    return this.authService.refresh(refreshToken, res);
  }

  // Rate limiting: 100 requests por minuto
  @Throttle({ short: { limit: 100, ttl: 60_000 } })
  @Post('logout')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const refreshToken = req.cookies?.refresh_token;
    const user = req.user;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || null;
    return this.authService.logout(refreshToken, res, user?.userId, user?.empresaId, ip, userAgent);
  }

  @Throttle({ short: { limit: 100, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async logoutAll(@Request() req: any, @Res({ passthrough: true }) res: any) {
    const userId = req.user?.userId;
    const empresaId = req.user?.empresaId;
    
    if (!userId) {
      return res.status(400).json({
        message: 'No se pudo identificar el usuario',
        code: 'INVALID_USER',
      });
    }
    
    try {
      await this.authService.logoutAll(userId);
      
      this.authService.clearRefreshTokenCookie(res);
      
      return { 
        message: 'Todas las sesiones han sido cerradas',
        success: true,
      };
    } catch (error) {
      return res.status(500).json({
        message: 'Error al cerrar todas las sesiones',
        code: 'LOGOUT_ALL_ERROR',
      });
    }
  }

  // 🔒 GET /auth/me - Devuelve datos completos del usuario actual
  @Throttle({ short: { limit: 30, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: any) {
    return this.authService.getCurrentUser(req.user.userId);
  }

  @Throttle({ short: { limit: 30, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin-only')
  adminOnly(@Request() req: any) {
    return { message: 'Solo admins', user: req.user };
  }
}