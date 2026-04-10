import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // LIMPIEZA DIARIA A LAS 3:00 AM
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('0 3 * * *') // Diario a las 3:00 AM
  async cleanupExpiredTokens() {
    this.logger.log('Iniciando limpieza de tokens expirados...');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revoked: true, revokedAt: { lt: thirtyDaysAgo } },
        ],
      },
    });

    this.logger.log(`Limpieza completada: ${result.count} tokens eliminados`);
    return result.count;
  }
}
