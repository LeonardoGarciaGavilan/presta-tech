import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushNotificationsService {
  private readonly expo = new Expo();
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enviarPushNotifications(
    tokens: string[],
    titulo: string,
    cuerpo: string,
    data: Record<string, any> = {},
  ): Promise<void> {
    const tokensValidos = tokens.filter((t) => Expo.isExpoPushToken(t));
    if (tokensValidos.length === 0) {
      this.logger.warn('No hay tokens válidos para enviar push notifications');
      return;
    }

    const messages: ExpoPushMessage[] = tokensValidos.map((token) => ({
      to: token,
      sound: 'default',
      title: titulo,
      body: cuerpo,
      data,
      priority: 'high' as const,
      channelId: 'alertas',
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        this.logger.error('Error enviando push notification batch:', error);
      }
    }

    const receiptIds = tickets
      .map((t) => (t as any).id)
      .filter((id): id is string => Boolean(id));

    if (receiptIds.length === 0) return;

    const receipts = await this.expo.getPushNotificationReceiptsAsync(receiptIds);

    for (const [id, receipt] of Object.entries(receipts)) {
      if (receipt.status !== 'error') continue;

      const errorCode = receipt.details?.error;

      switch (errorCode) {
        case 'DeviceNotRegistered':
          this.logger.warn(`Token stale detectado (DeviceNotRegistered): ${id}`);
          await this.limpiarTokenStale(id);
          break;
        case 'InvalidCredentials':
          this.logger.warn(`Token push inválido (InvalidCredentials): ${id}`);
          break;
        case 'MessageTooBig':
          this.logger.warn(`Mensaje demasiado grande: ${id}`);
          break;
        case 'MessageRateExceeded':
          this.logger.warn(`Límite de mensajes excedido: ${id}`);
          break;
        default:
          this.logger.warn(`Error desconocido en push receipt [${id}]: ${errorCode}`);
      }
    }
  }

  private async limpiarTokenStale(token: string): Promise<void> {
    try {
      const result = await this.prisma.usuario.updateMany({
        where: { pushToken: token },
        data: { pushToken: null },
      });
      if (result.count > 0) {
        this.logger.log(`Token stale limpiado de ${result.count} usuario(s)`);
      }
    } catch (error) {
      this.logger.error('Error limpiando token stale:', error);
    }
  }
}
