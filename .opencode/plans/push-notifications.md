# Plan: Push Notifications para Alertas de Préstamos

## Resumen
Agregar notificaciones push nativas al módulo de alertas de la app mobile (Expo). Cuando se cree una alerta de préstamo (cambio de estado, cancelación, refinanciamiento, etc.), los ADMIN/SUPERADMIN recibirán una notificación push en su teléfono. Al tocarla, se abre la pantalla de alertas.

---

## Paso 1: Backend — Modelo Prisma

**Archivo:** `backend/prisma/schema.prisma`

Agregar campo `pushToken` al modelo `Usuario`:

```prisma
model Usuario {
  id                  String                 @id @default(uuid())
  nombre              String
  email               String                 @unique
  password            String
  rol                 Rol                    @default(EMPLEADO)
  activo              Boolean                @default(true)
  debeCambiarPassword Boolean                @default(true)
  pushToken           String?                // <-- NUEVO
  createdAt           DateTime               @default(now())
  empresaId           String?
  // ... resto igual
}
```

Ejecutar migración:
```bash
cd backend
npx prisma migrate dev --name add-push-token
```

---

## Paso 2: Backend — Servicio Push Notifications

**Archivo nuevo:** `backend/src/notificaciones/push-notifications.service.ts`

```typescript
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
    // Filtrar tokens inválidos
    const tokensValidos = tokens.filter((t) => Expo.isExpoPushToken(t));
    if (tokensValidos.length === 0) return;

    const messages: ExpoPushMessage[] = tokensValidos.map((token) => ({
      to: token,
      sound: 'default',
      title: titulo,
      body: cuerpo,
      data,
      priority: 'high',
    }));

    // Enviar en batches de 100
    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        this.logger.error('Error enviando push notifications:', error);
      }
    }

    // Manejar tickets con error (token inválido/expirado)
    const receipts = await this.expo.getPushNotificationReceiptsAsync(
      tickets.map((t) => (t as any).id).filter(Boolean),
    );

    for (const [id, receipt] of Object.entries(receipts)) {
      if (receipt.status === 'error' && receipt.details?.error === 'InvalidCredentials') {
        this.logger.warn(`Token inválido detectado: ${id}`);
        // Opcional: limpiar token de la DB aquí
      }
    }
  }
}
```

**Archivo:** `backend/src/notificaciones/notificaciones.module.ts`

Agregar como provider y export:

```typescript
import { PushNotificationsService } from './push-notifications.service';

@Module({
  providers: [NotificacionesService, PushNotificationsService],
  controllers: [NotificacionesController],
  exports: [PushNotificationsService],
})
export class NotificacionesModule {}
```

---

## Paso 3: Backend — Endpoint para registrar Push Token

**Archivo:** `backend/src/usuario/usuario.controller.ts`

Agregar endpoint:

```typescript
@Patch('push-token')
@UseGuards(JwtAuthGuard)
async registrarPushToken(
  @Body('pushToken') pushToken: string,
  @Request() req,
) {
  return this.usuarioService.registrarPushToken(req.user.id, pushToken);
}
```

**Archivo:** `backend/src/usuario/usuario.service.ts`

Agregar método:

```typescript
async registrarPushToken(usuarioId: string, pushToken: string) {
  return this.prisma.usuario.update({
    where: { id: usuarioId },
    data: { pushToken },
    select: { id: true, pushToken: true },
  });
}
```

---

## Paso 4: Backend — Enviar push al crear alertas

**Archivo:** `backend/src/prestamos/prestamos.service.ts`

En el constructor, inyectar `PushNotificationsService`:

```typescript
constructor(
  private readonly prisma: PrismaService,
  @Optional() private readonly alertsGateway?: AlertsGateway,
  @Inject(CACHE_MANAGER) @Optional() private cacheManager?: Cache,
  @Optional() private readonly pushService?: PushNotificationsService, // <-- NUEVO
) {}
```

En el método `crearAlerta()`, después del bloque `if (this.alertsGateway)`, agregar:

```typescript
// Enviar push notifications a admins de la empresa
if (this.pushService) {
  try {
    const admins = await this.prisma.usuario.findMany({
      where: {
        empresaId: params.empresaId,
        activo: true,
        pushToken: { not: null },
        rol: { in: ['ADMIN', 'SUPERADMIN'] },
      },
      select: { pushToken: true },
    });

    const tokens = admins
      .map((u) => u.pushToken)
      .filter((t): t is string => !!t);

    if (tokens.length > 0) {
      const titulo = `Alerta — ${params.tipo.replace('_', ' ').toLowerCase()}`;
      await this.pushService.enviarPushNotifications(tokens, titulo, params.descripcion, {
        alertaId: alertaCreada.id,
        prestamoId: params.prestamoId,
        screen: 'admin/alertas',
      });
    }
  } catch (e) {
    console.error('Error enviando push notifications:', e);
  }
}
```

---

## Paso 5: Mobile — Instalar expo-notifications

```bash
cd mobile
npx expo install expo-notifications
```

**Archivo:** `mobile/app.json` — Agregar plugin:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-notifications",
      // ... resto de plugins
    ]
  }
}
```

---

## Paso 6: Mobile — Servicio de notificaciones

**Archivo nuevo:** `mobile/src/services/notifications.service.ts`

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Configurar canal de notificación en Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alertas', {
      name: 'Alertas de Préstamos',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
      sound: 'default',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}
```

---

## Paso 7: Mobile — Hook usePushNotifications

**Archivo nuevo:** `mobile/src/hooks/use-push-notifications.ts`

```typescript
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { registerForPushNotificationsAsync } from '@/services/notifications.service';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/ui/toast';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const router = useRouter();
  const { showToast } = useToast();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.rol === 'ADMIN' || user?.rol === 'SUPERADMIN';
  const responseListener = useRef<Notifications.EventSubscription>();

  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const api = axios.create({
        baseURL: process.env.EXPO_PUBLIC_API_URL,
      });
      const sessionStr = await import('@/utils/session').then((m) =>
        m.getSession(),
      );
      if (sessionStr?.accessToken) {
        api.defaults.headers.common['Authorization'] = `Bearer ${sessionStr.accessToken}`;
      }
      return api.patch('/usuario/push-token', { pushToken: token });
    },
  });

  useEffect(() => {
    if (!isAdmin) return;

    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        saveTokenMutation.mutate(token);
      }
    });

    // Listener para notificaciones en foreground
    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        showToast(
          notification.request.content.title ?? 'Nueva notificación',
          'info',
        );
      },
    );

    // Listener para cuando se toca la notificación
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const screen = response.notification.request.content.data?.screen;
        if (screen) {
          router.push(screen as any);
        }
      });

    return () => {
      receivedSub.remove();
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAdmin]);
}
```

---

## Paso 8: Mobile — Integrar hook en layout

**Archivo:** `mobile/app/(app)/_layout.tsx`

Agregar al inicio del componente del layout autenticado:

```typescript
import { usePushNotifications } from '@/hooks/use-push-notifications';

export default function AppLayout() {
  usePushNotifications(); // <-- NUEVO
  // ... resto del layout
}
```

---

## Archivos a modificar/crear

| # | Archivo | Acción |
|---|---------|--------|
| 1 | `backend/prisma/schema.prisma` | Agregar `pushToken` a Usuario |
| 2 | `backend/prisma/migrations/...` | Generar migración |
| 3 | `backend/src/notificaciones/push-notifications.service.ts` | **Nuevo** |
| 4 | `backend/src/notificaciones/notificaciones.module.ts` | Registrar servicio |
| 5 | `backend/src/usuario/usuario.controller.ts` | Endpoint PATCH push-token |
| 6 | `backend/src/usuario/usuario.service.ts` | Método registrarPushToken |
| 7 | `backend/src/prestamos/prestamos.service.ts` | Inyectar pushService, enviar en crearAlerta |
| 8 | `mobile/package.json` | Instalar expo-notifications |
| 9 | `mobile/app.json` | Agregar plugin |
| 10 | `mobile/src/services/notifications.service.ts` | **Nuevo** |
| 11 | `mobile/src/hooks/use-push-notifications.ts` | **Nuevo** |
| 12 | `mobile/app/(app)/_layout.tsx` | Integrar hook |

---

## Notas importantes

- **expo-server-sdk**: Se instala en el backend con `npm install expo-server-sdk`
- **Permisos**: El usuario debe aceptar los permisos de notificación la primera vez
- **Android**: Se configura un canal de notificación "Alertas de Préstamos" con prioridad alta
- **Foreground**: Cuando la app está abierta, se muestra un toast in-app
- **Background/Killed**: La notificación se muestra nativamente
- **Tap**: Al tocar la notificación, se navega a `admin/alertas`
- **Solo ADMIN/SUPERADMIN**: Solo estos roles reciben push tokens guardados
