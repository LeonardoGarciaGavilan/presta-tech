import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import type { ThemeMode } from '@/store/theme.store';
import { useTheme } from './theme-provider';

interface ThemeSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

const options: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
  { mode: 'light', label: 'Claro', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Oscuro', icon: 'moon-outline' },
];

export function ThemeSelectorModal({ visible, onClose }: ThemeSelectorModalProps) {
  const { themeMode, setThemeMode, colors } = useTheme();

  const handleSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>Apariencia</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Selecciona cómo quieres ver la app
          </Text>

          {options.map(({ mode, label, icon }) => {
            const isSelected = themeMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.option,
                  { backgroundColor: isSelected ? colors.primaryLight : colors.surface },
                ]}
                activeOpacity={0.7}
                onPress={() => handleSelect(mode)}
              >
                <Ionicons
                  name={icon}
                  size={22}
                  color={isSelected ? colors.primary : colors.text}
                />
                <Text
                  style={[
                    styles.optionText,
                    { color: isSelected ? colors.primary : colors.text },
                  ]}
                >
                  {label}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  optionText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    marginLeft: Spacing.md,
    flex: 1,
  },
});
