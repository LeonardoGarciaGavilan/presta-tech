import { Module } from '@nestjs/common';
import { FinanzasController } from './finanzas.controller';
import { FinanzasService } from './finanzas.service';
import { CapitalController } from './capital.controller';
import { CapitalService } from './capital.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FinanzasController, CapitalController],
  providers: [FinanzasService, CapitalService],
  exports: [CapitalService],
})
export class FinanzasModule {}