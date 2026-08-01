// src/sync/dto/report-clear.dto.ts
import {
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
} from 'class-validator';

export class QueueItemSummaryDto {
  @IsString()
  endpoint: string;

  @IsString()
  method: string;

  @IsNumber()
  createdAt: number;

  @IsOptional()
  @IsNumber()
  monto?: number;
}

export class ReportClearDto {
  @IsArray()
  items: QueueItemSummaryDto[];

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
