import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

import { AuthGuard } from '@/components/auth/auth-guard';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { NetworkBanner } from '@/components/ui/network-banner';

export default function AppLayout() {
  return (
    <AuthGuard>
      <ErrorBoundary>
        <View style={styles.container}>
          <NetworkBanner />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(drawer)" />
            <Stack.Screen name="pagos" />
          </Stack>
        </View>
      </ErrorBoundary>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
