import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useCedulaSignedUrl } from '@/hooks/use-clientes';
import { BorderRadius, FontSize, FontWeight, Shadows, Spacing, scale} from '@/constants/theme';
import type { Cliente } from '@/types/cliente.types';
import { useTheme } from '@/components/ui/theme-provider';

interface DocumentViewerProps {
  cliente: Cliente;
}

function CedulaImage({
  signedUrl,
  isLoading,
  hasError,
  label,
  iconName,
  onPress,
  onRetry,
  colors,
}: {
  signedUrl: string | undefined;
  isLoading: boolean;
  hasError: boolean;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  onRetry?: () => void;
  colors: any;
}) {
  if (isLoading) {
    return (
      <View
        style={[
          styles.docCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.docPlaceholder}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
        <View style={styles.docLabel}>
          <Ionicons name={iconName} size={scale(14)} color={colors.textTertiary} />
          <Text style={[styles.docLabelText, { color: colors.textTertiary }]}>
            {label}
          </Text>
        </View>
      </View>
    );
  }

  if (hasError || !signedUrl) {
    return (
      <View
        style={[
          styles.docCard,
          { backgroundColor: colors.surface, borderColor: colors.errorLight },
        ]}
      >
        <View style={styles.docPlaceholder}>
          <Ionicons
            name="image-outline"
            size={scale(32)}
            color={colors.textTertiary}
          />
          <Text style={[styles.docError, { color: colors.error }]}>
            Error al cargar
          </Text>
          {onRetry && (
            <Pressable onPress={onRetry} style={styles.retryBtn}>
              <Ionicons name="refresh" size={scale(16)} color={colors.primary} />
              <Text style={[styles.retryText, { color: colors.primary }]}>
                Reintentar
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.docLabel}>
          <Ionicons name={iconName} size={scale(14)} color={colors.textTertiary} />
          <Text style={[styles.docLabelText, { color: colors.textTertiary }]}>
            {label}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.docCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Image
        source={{ uri: signedUrl }}
        style={styles.docImage}
        resizeMode="cover"
      />
      <View style={styles.docLabel}>
        <Ionicons name={iconName} size={scale(14)} color={colors.primary} />
        <Text style={[styles.docLabelText, { color: colors.text }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default function DocumentViewer({ cliente }: DocumentViewerProps) {
  const { colorScheme, colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const frontalQuery = useCedulaSignedUrl(
    cliente.id,
    cliente.cedulaFrontalPath ? 'cedula-frontal' : null,
  );
  const traseraQuery = useCedulaSignedUrl(
    cliente.id,
    cliente.cedulaTraseraPath ? 'cedula-trasera' : null,
  );

  const tieneFrontal = !!cliente.cedulaFrontalPath;
  const tieneTrasera = !!cliente.cedulaTraseraPath;
  const docCount = [tieneFrontal, tieneTrasera].filter(Boolean).length;

  if (!tieneFrontal && !tieneTrasera) return null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
        Shadows.sm,
      ]}
    >
      <Pressable
        style={styles.header}
        onPress={() => setIsExpanded((prev) => !prev)}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="id-card-outline" size={scale(18)} color={colors.text} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Documentos
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              {docCount}
            </Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={scale(20)}
          color={colors.textTertiary}
        />
      </Pressable>

      {isExpanded && (
        <View style={styles.grid}>
          {tieneFrontal && (
            <CedulaImage
              signedUrl={frontalQuery.data?.signedUrl}
              isLoading={frontalQuery.isLoading}
              hasError={!!frontalQuery.error}
              label="Frontal"
              iconName="id-card"
              onPress={() =>
                frontalQuery.data?.signedUrl &&
                setSelectedImage(frontalQuery.data!.signedUrl)
              }
              onRetry={() => frontalQuery.refetch()}
              colors={colors}
            />
          )}
          {tieneTrasera && (
            <CedulaImage
              signedUrl={traseraQuery.data?.signedUrl}
              isLoading={traseraQuery.isLoading}
              hasError={!!traseraQuery.error}
              label="Trasera"
              iconName="id-card"
              onPress={() =>
                traseraQuery.data?.signedUrl &&
                setSelectedImage(traseraQuery.data!.signedUrl)
              }
              onRetry={() => traseraQuery.refetch()}
              colors={colors}
            />
          )}
        </View>
      )}

      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedImage(null)}
        >
          <Pressable style={styles.modalContent}>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
            <Pressable
              onPress={() => setSelectedImage(null)}
              style={styles.closeButton}
            >
              <Ionicons name="close-circle" size={scale(32)} color="#FFFFFF" />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(1),
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  grid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  docCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  docImage: {
    width: '100%',
    height: scale(140),
  },
  docPlaceholder: {
    height: scale(140),
    justifyContent: 'center',
    alignItems: 'center',
  },
  docError: {
    fontSize: FontSize.xs,
    marginTop: scale(4),
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  retryText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  docLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    padding: Spacing.sm,
  },
  docLabelText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '70%',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    padding: scale(4),
  },
});
