import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      return client.patch('/usuarios/push-token', { pushToken: token });
    },
    onError: (error) => {
      console.warn('Error guardando push token:', error);
    },
  });

  const routerRef = useRef(router);
  routerRef.current = router;

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const saveTokenRef = useRef(saveTokenMutation);
  saveTokenRef.current = saveTokenMutation;

  const registerAndSaveToken = useCallback(async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        saveTokenRef.current.mutate(token);
      }
    } catch (error) {
      console.warn('Error registrando push token:', error);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    registerAndSaveToken();

    const tokenSub = Notifications.addPushTokenListener((token) => {
      if (token?.data) {
        saveTokenRef.current.mutate(token.data);
      }
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (prev.match(/inactive|background/) && nextState === 'active') {
        registerAndSaveToken();
      }
    });

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const title = notification.request.content.title;
        const body = notification.request.content.body;
        showToastRef.current(body ?? title ?? 'Nueva notificacion', 'info');
      },
    );

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const screen = response.notification.request.content.data?.screen;
        if (screen) {
          routerRef.current.push(screen as any);
        }
      });

    return () => {
      tokenSub.remove();
      appStateSub.remove();
      receivedSub.remove();
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAdmin, registerAndSaveToken]);
}
