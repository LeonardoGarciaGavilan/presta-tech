import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';

import { BorderRadius, FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';
import { AppButton } from '@/components/ui/app-button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
    });
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: colors.errorLight }]}>
          <Ionicons name="bug-outline" size={scale(48)} color={colors.error} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          Algo salió mal
        </Text>

        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Ocurrió un error inesperado. Por favor intenta de nuevo.
        </Text>

        {__DEV__ && (
          <View style={[styles.errorDetails, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.errorLabel, { color: colors.error }]}>
              {error.name}
            </Text>
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>
              {error.message}
            </Text>
          </View>
        )}

        <AppButton
          title="Reintentar"
          icon="refresh-outline"
          onPress={onRetry}
          style={styles.retryButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: scale(88),
    height: scale(88),
    borderRadius: scale(44),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: scale(22),
    marginBottom: Spacing.lg,
  },
  errorDetails: {
    width: '100%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  errorLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  errorText: {
    fontSize: FontSize.xs,
    fontFamily: 'monospace',
  },
  retryButton: {
    width: '100%',
  },
});
