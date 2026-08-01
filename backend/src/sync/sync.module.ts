// src/sync/sync.module.ts
import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SyncController],
})
export class SyncModule {}
