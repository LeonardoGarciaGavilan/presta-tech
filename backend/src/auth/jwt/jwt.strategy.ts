// src/auth/jwt/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('jwt.secret');
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET no configurado');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Primero intentar desde cookie "token"
        (req) => {
          if (req?.cookies?.token) {
            return req.cookies.token;
          }
          return null;
        },
        // Fallback: desde Authorization header (para APIs que usan bearer)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    return {
      userId:    payload.sub,
      email:     payload.email,
      nombre:    payload.nombre,
      rol:       payload.rol,
      empresaId: payload.empresaId,
    };
  }
}