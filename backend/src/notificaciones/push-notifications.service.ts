import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

@Injectable()
export class PushNotificationsService {
  private readonly expo = new Expo();
  private readonly logger = new Logger(PushNotificationsService.name);

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
      if (
        receipt.status === 'error' &&
        receipt.details?.error === 'InvalidCredentials'
      ) {
        this.logger.warn(`Token push inválido detectado: ${id}`);
      }
    }
  }
}
