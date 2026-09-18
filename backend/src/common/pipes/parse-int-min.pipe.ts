// src/common/pipes/parse-int-min.pipe.ts
import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseIntMinPipe implements PipeTransform {
  constructor(private readonly min: number = 1) {}

  transform(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new BadRequestException('El valor debe ser un número entero');
    }
    if (parsed < this.min) {
      throw new BadRequestException(
        `El valor debe ser mayor o igual a ${this.min}`,
      );
    }
    return parsed;
  }
}
