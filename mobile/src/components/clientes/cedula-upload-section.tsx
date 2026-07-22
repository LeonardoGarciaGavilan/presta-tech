import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { uploadCedula } from '@/api/clientes.api';
import compressImage from '@/utils/compress-image';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';
import { useToast } from '@/components/ui/toast';

interface CedulaUploadSectionProps {
  clienteId?: string;
  onFrontalChange?: (uri: string | null) => void;
  onTraseraChange?: (uri: string | null) => void;
  frontalUri: string | null;
  traseraUri: string | null;
  existingFrontalUrl?: string | null;
  existingTraseraUrl?: string | null;
  onUploadComplete?: () => void;
}

interface CedulaSideProps {
  label: string;
  tipo: 'cedula-frontal' | 'cedula-trasera';
  uri: string | null;
  existingUrl?: string | null;
  clienteId: string | undefined;
  onImagePicked: (uri: string | null) => void;
  onUploadComplete?: () => void;
  colors: typeof Colors.light;
}

function CedulaSide({
  label,
  tipo,
  uri,
  existingUrl,
  clienteId,
  onImagePicked,
  onUploadComplete,
  colors,
}: CedulaSideProps) {
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const pickImage = async (useCamera: boolean) => {
    try {
      setUploadError(null);

      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showToast('Se necesita permiso de cámara para tomar fotos.', 'error');
          return;
        }
      } else {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showToast('Se necesita permiso para acceder a la galería.', 'error');
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
            aspect: [4, 3],
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
            aspect: [4, 3],
          });

      if (!result.canceled && result.assets[0]) {
        setIsProcessing(true);
        const rawUri = result.assets[0].uri;

        let compressedUri: string;
        try {
          compressedUri = await compressImage(rawUri);
        } catch (err: any) {
          setUploadError(err?.message || 'Error al procesar la imagen');
          return;
        }

        if (clienteId) {
          onImagePicked(compressedUri);
          try {
            await uploadCedula(clienteId, tipo, compressedUri);
            onUploadComplete?.();
          } catch (err: any) {
            setUploadError(err?.message || 'Error al subir la imagen');
          }
        } else {
          onImagePicked(compressedUri);
        }
      }
    } catch (err) {
      setUploadError('Ocurrió un error inesperado al procesar la imagen');
    } finally {
      setIsProcessing(false);
    }
  };

  const displayUri = uri || existingUrl;
  const hasImage = !!displayUri;
  const borderColor = uploadError
    ? colors.error
    : uri
      ? colors.success
      : existingUrl
        ? colors.primary
        : colors.border;

  return (
    <View
      style={[
        styles.sideCard,
        {
          backgroundColor: colors.surface,
          borderColor,
        },
      ]}
    >
      <Text style={[styles.sideLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>

      {hasImage ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: displayUri! }}
            style={styles.preview}
            resizeMode="cover"
          />
          {!clienteId && uri && (
            <Pressable
              onPress={() => onImagePicked(null)}
              style={styles.removeBtn}
            >
              <Ionicons name="close-circle" size={scale(22)} color={colors.error} />
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="id-card-outline" size={scale(32)} color={colors.textTertiary} />
          <Text style={[styles.placeholderText, { color: colors.textTertiary }]}>
            {isProcessing ? 'Comprimiendo...' : 'Sin foto'}
          </Text>
        </View>
      )}

      {uploadError && (
        <Text style={[styles.uploadError, { color: colors.error }]}>
          {uploadError}
        </Text>
      )}

      <View style={styles.buttons}>
        <Pressable
          onPress={() => pickImage(true)}
          disabled={isProcessing}
          style={[
            styles.smallBtn,
            { backgroundColor: colors.primaryLight, borderColor: colors.primary },
          ]}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="camera" size={scale(14)} color={colors.primary} />
              <Text style={[styles.smallBtnText, { color: colors.primary }]}>
                Cámara
              </Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={() => pickImage(false)}
          disabled={isProcessing}
          style={[
            styles.smallBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="images" size={scale(14)} color={colors.textSecondary} />
          <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>
            Galería
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CedulaUploadSection({
  clienteId,
  onFrontalChange,
  onTraseraChange,
  frontalUri,
  traseraUri,
  existingFrontalUrl,
  existingTraseraUrl,
  onUploadComplete,
}: CedulaUploadSectionProps) {
  const { colorScheme, colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.title, { flexDirection: 'row', alignItems: 'center', gap: scale(6) }]}>
        <Ionicons name="document-outline" size={scale(14)} color={colors.textSecondary} />
        <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.textSecondary }}>
          Documentos
          <Text style={[styles.optional, { color: colors.textTertiary }]}>
            {' '}
            (Opcional)
          </Text>
        </Text>
      </View>

      <View style={styles.grid}>
        <CedulaSide
          label="Cédula Frontal"
          tipo="cedula-frontal"
          uri={frontalUri}
          existingUrl={existingFrontalUrl}
          clienteId={clienteId}
          onImagePicked={onFrontalChange ?? (() => {})}
          onUploadComplete={onUploadComplete}
          colors={colors}
        />
        <CedulaSide
          label="Cédula Trasera"
          tipo="cedula-trasera"
          uri={traseraUri}
          existingUrl={existingTraseraUrl}
          clienteId={clienteId}
          onImagePicked={onTraseraChange ?? (() => {})}
          onUploadComplete={onUploadComplete}
          colors={colors}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  optional: {
    fontWeight: FontWeight.regular,
  },
  grid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sideCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  sideLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  previewContainer: {
    position: 'relative',
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  preview: {
    width: '100%',
    height: scale(100),
    borderRadius: BorderRadius.sm,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: scale(11),
  },
  placeholder: {
    height: scale(100),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  placeholderText: {
    fontSize: FontSize.xs,
    marginTop: scale(4),
  },
  uploadError: {
    fontSize: scale(10),
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  smallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
    paddingVertical: scale(6),
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  smallBtnText: {
    fontSize: scale(10),
    fontWeight: FontWeight.semibold,
  },
});
