import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardMobileService } from './dashboard-mobile.service';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardMobileService],
  exports: [DashboardService, DashboardMobileService],
})
export class DashboardModule {}
