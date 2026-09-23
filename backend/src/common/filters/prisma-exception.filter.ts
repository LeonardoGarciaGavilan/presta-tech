import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { IdempotencyKeyCollisionException } from './idempotency-collision.exception';

const UNIQUE_CONSTRAINT_CODE = 'P2002';

@Catch(PrismaClientKnownRequestError, IdempotencyKeyCollisionException)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(
    exception: PrismaClientKnownRequestError | IdempotencyKeyCollisionException,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof IdempotencyKeyCollisionException) {
      const errorResponse = exception.getResponse() as Record<string, unknown>;
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        code: errorResponse.code,
        message: errorResponse.message,
      });
      return;
    }

    if (exception.code === UNIQUE_CONSTRAINT_CODE) {
      const meta = exception.meta as { target?: string[] } | undefined;
      const fields = meta?.target?.join(', ') ?? 'desconocido';

      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: `Ya existe un registro con el mismo valor en: ${fields}`,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Error inesperado en la base de datos',
    });
  }
}
