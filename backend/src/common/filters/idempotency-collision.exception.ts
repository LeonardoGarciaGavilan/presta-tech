import { ConflictException } from '@nestjs/common';

export class IdempotencyKeyCollisionException extends ConflictException {
  constructor(message = 'La idempotencyKey ya pertenece a otra operación') {
    super({
      statusCode: 409,
      code: 'IDEMPOTENCY_KEY_COLLISION',
      message,
    });
  }

  getCode(): string {
    return 'IDEMPOTENCY_KEY_COLLISION';
  }
}
