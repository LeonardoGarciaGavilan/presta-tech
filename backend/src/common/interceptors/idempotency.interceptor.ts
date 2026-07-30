import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';
import type { Request, Response } from 'express';

const IDEMPOTENCY_TTL_MS = 86_400_000; // 24h
const IDEMPOTENCY_HEADER = 'X-Idempotency-Key';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CACHE_MANAGER) @Optional() private cacheManager?: Cache,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isIdempotent || !this.cacheManager) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const idempotencyKey = request.headers[IDEMPOTENCY_HEADER.toLowerCase()] as string | undefined;
    if (!idempotencyKey) {
      return next.handle();
    }

    const cacheKey = `idempotency:${request.method}:${request.path}:${idempotencyKey}`;

    try {
      const cached = await this.cacheManager.get<{ statusCode: number; body: unknown }>(cacheKey);
      if (cached) {
        response.status(cached.statusCode);
        return of(cached.body);
      }
    } catch {
      // Cache error is non-critical, proceed normally
    }

    return next.handle().pipe(
      tap(async (body: unknown) => {
        try {
          await this.cacheManager?.set(
            cacheKey,
            { statusCode: response.statusCode, body },
            IDEMPOTENCY_TTL_MS,
          );
        } catch {
          // Non-critical
        }
      }),
    );
  }
}
