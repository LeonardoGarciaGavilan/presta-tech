import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useMutation } from '@tanstack/react-query';

import { registerForPushNotificationsAsync } from '@/services/notifications.service';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/ui/toast';
import client from '@/api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const router = useRouter();
  const { showToast } = useToast();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.rol === 'ADMIN' || user?.rol === 'SUPERADMIN';
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      return client.patch('/usuarios/push-token', { pushToken: token });
    },
  });

  useEffect(() => {
    if (!isAdmin) return;

    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        saveTokenMutation.mutate(token);
      }
    });

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const title = notification.request.content.title;
        const body = notification.request.content.body;
        showToast(body ?? title ?? 'Nueva notificacion', 'info');
      },
    );

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
