// src/alerts/alerts.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/alerts',
  transports: ['websocket', 'polling'],
})
export class AlertsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('Sin token');

      const payload = this.jwtService.verify(token); // 👈 sin secret, lo hereda del módulo

      client.data.user = payload;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const empresaId = client.data.user?.empresaId;
    console.log(`Cliente desconectado: ${client.id} | empresa: ${empresaId ?? 'desconocida'}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { empresaId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.empresaId) return;

    const empresaIdDelToken = client.data.user?.empresaId;
    if (!empresaIdDelToken || empresaIdDelToken !== data.empresaId) {
      client.disconnect(true);
      return;
    }

    client.join(`empresa:${empresaIdDelToken}`);
  }

  emitirNuevaAlerta(empresaId: string, alerta: any) {
    this.server.to(`empresa:${empresaId}`).emit('nueva_alerta', alerta);
  }

  emitirContador(empresaId: string, count: number) {
    this.server.to(`empresa:${empresaId}`).emit('contador_alertas', { count });
  }

  private extractToken(client: Socket): string | null {
    // 1️⃣ Primero: intentar desde cookie (cuando se usa withCredentials)
    const cookieHeader = client.handshake.headers?.cookie;
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map(c => c.split('='))
      );
      if (cookies['token']) {
        return cookies['token'];
      }
    }

    // 2️⃣ Segundo: Authorization header (Bearer token)
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // 3️⃣ Tercero: auth object en handshake (legacy)
    return client.handshake.auth?.token ?? null;
  }
}