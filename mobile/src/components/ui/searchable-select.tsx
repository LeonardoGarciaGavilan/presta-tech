import React, { useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, FontWeight, Spacing, BorderRadius, scale} from '@/constants/theme';
import type { Cliente } from '@/types/cliente.types';
import { useTheme } from '@/components/ui/theme-provider';

interface SearchableSelectProps {
  label: string;
  placeholder?: string;
  value: Cliente | null;
  searchText: string;
  onSearchChange: (text: string) => void;
  sugerencias: Cliente[];
  showSugerencias: boolean;
  onSelect: (item: Cliente) => void;
  onClear: () => void;
  error?: string;
  disabled?: boolean;
  disabledText?: string;
  buscando?: boolean;
  accentColor?: string;
  accentLight?: string;
  onFocus?: () => void;
}

export default function SearchableSelect({
  label,
  placeholder = 'Buscar...',
  value,
  searchText,
  onSearchChange,
  sugerencias,
  showSugerencias,
  onSelect,
  onClear,
  error,
  disabled,
  disabledText,
  buscando,
  accentColor,
  accentLight,
  onFocus,
}: SearchableSelectProps) {
  const { colorScheme, colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const handleClear = () => {
    onClear();
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (disabled) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>{disabledText || 'No disponible'}</Text>
      </View>
    );
  }

  if (value) {
    const bgColor = accentLight || colors.primaryLight;
    const borderColor = accentColor || colors.primary;
    const textColor = accentColor || colors.primary;
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{label}</Text>
        <View style={[styles.selectedItem, { backgroundColor: bgColor, borderColor }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.selectedName, { color: textColor }]}>
              {value.nombre} {value.apellido}
            </Text>
            <Text style={[styles.selectedSub, { color: textColor }]}>
              {value.cedula}
            </Text>
          </View>
          <Pressable onPress={handleClear} hitSlop={8}>
            <Ionicons name="close-circle" size={scale(20)} color={textColor} />
          </Pressable>
        </View>
      </View>
    );
  }

  const inputBorder = error ? colors.error : colors.border;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{label}</Text>
      <View>
        <View style={styles.searchRow}>
          <TextInput
            ref={inputRef}
            value={searchText}
            onChangeText={onSearchChange}
            onFocus={onFocus}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { backgroundColor: colors.surfaceElevated, borderColor: inputBorder, color: colors.text }]}
          />
          {buscando && <ActivityIndicator size="small" style={styles.searchSpinner} />}
        </View>
        {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
        {showSugerencias && sugerencias.length > 0 && (
          <View style={[styles.suggestions, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {sugerencias.map(c => (
              <Pressable
                key={c.id}
                onPress={() => onSelect(c)}
                style={({ pressed }) => [styles.suggestionItem, pressed && { backgroundColor: accentLight || colors.primaryLight }]}
              >
                <Text style={[styles.suggestionName, { color: colors.text }]}>
                  {c.nombre} {c.apellido}
                </Text>
                <Text style={[styles.suggestionSub, { color: colors.textTertiary }]}>{c.cedula}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  hint: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    paddingVertical: Spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: scale(48),
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
  },
  searchSpinner: {
    position: 'absolute',
    right: Spacing.md,
  },
  errorText: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  suggestions: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 0,
  },
  suggestionName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  suggestionSub: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  selectedName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  selectedSub: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
});
