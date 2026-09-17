import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '@/components/ui/theme-provider';
import { Ionicons } from '@expo/vector-icons';
import Badge from './badge';
import { incluyeNormalizado } from '@/utils/texto';
import type { OpcionPicker } from '@/types/ubicaciones.types';

import {
  BorderRadius,
  FontSize,
  FontWeight,
  Spacing,
  scale,
} from '@/constants/theme';

interface OpcionesNormalizadas {
  label: string;
  value: string;
  badge?: string;
}

interface PickerFieldProps {
  label: string;
  placeholder?: string;
  value: string | undefined;
  options: OpcionPicker[];
  onSelect: (value: string) => void;
  editable?: boolean;
  error?: string;
  hint?: string;
  searchable?: boolean;
  required?: boolean;
}

export default function PickerField({
  label,
  placeholder = 'Seleccionar…',
  value,
  options,
  onSelect,
  editable = true,
  error,
  hint,
  searchable = true,
  required = false,
}: PickerFieldProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Retrocompatibilidad: `string[]` → label=value; objeto → {label, value, badge}.
  const opciones = useMemo<OpcionesNormalizadas[]>(
    () =>
      options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o)),
    [options],
  );

  const filteredOptions = useMemo(() => {
    if (!search) return opciones;
    return opciones.filter((o) => incluyeNormalizado(search, o.label));
  }, [opciones, search]);

  const selected = useMemo(
    () => opciones.find((o) => o.value === value),
    [opciones, value],
  );

  const handleOpen = useCallback(() => {
    if (!editable) return;
    Keyboard.dismiss();
    setSearch('');
    setVisible(true);
  }, [editable]);

  const handleSelect = useCallback(
    (option: OpcionesNormalizadas) => {
      onSelect(option.value);
      setVisible(false);
    },
    [onSelect],
  );

  const handleDismiss = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <>
      <Pressable
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: error ? colors.error : colors.border,
            opacity: !editable ? 0.5 : pressed ? 0.9 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            { color: error ? colors.error : colors.textTertiary },
          ]}
        >
          {label}
          {required && <Text style={{ color: colors.error }}> *</Text>}
        </Text>
        <View style={styles.inputRow}>
          <Text
            style={[
              styles.inputText,
              {
                color: value ? colors.text : colors.textTertiary,
              },
            ]}
            numberOfLines={1}
          >
            {selected?.label || value || placeholder}
          </Text>
          {selected?.badge && (
            <Badge label={selected.badge} color={colors.primary} />
          )}
          <Ionicons
            name="chevron-down"
            size={scale(16)}
            color={colors.textTertiary}
          />
        </View>
        {error && (
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
        )}
        {hint && !error && (
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            {hint}
          </Text>
        )}
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleDismiss}
      >
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.overlay }]}
          onPress={handleDismiss}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardArea}
          >
            <Pressable
              style={[
                styles.modal,
                { backgroundColor: colors.surfaceElevated },
              ]}
              onPress={() => {}}
            >
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {label}
                </Text>
                <Pressable onPress={handleDismiss} hitSlop={8}>
                  <Ionicons name="close" size={scale(24)} color={colors.text} />
                </Pressable>
              </View>

              {searchable && options.length > 10 && (
                <View
                  style={[
                    styles.searchContainer,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Ionicons
                    name="search"
                    size={scale(16)}
                    color={colors.textTertiary}
                  />
                  <TextInput
                    ref={inputRef}
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Buscar…"
                    placeholderTextColor={colors.textTertiary}
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {search ? (
                    <Pressable onPress={() => setSearch('')} hitSlop={6}>
                      <Ionicons
                        name="close-circle"
                        size={scale(16)}
                        color={colors.textTertiary}
                      />
                    </Pressable>
                  ) : null}
                </View>
              )}

              <FlatList
                data={filteredOptions}
                keyExtractor={(item) => item.value}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                keyboardDismissMode="on-drag"
                style={styles.list}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <Text
                    style={[styles.emptyText, { color: colors.textTertiary }]}
                  >
                    Sin resultados
                  </Text>
                }
                renderItem={({ item }) => {
                  const esSeleccionado = item.value === value;
                  return (
                    <Pressable
                      onPress={() => handleSelect(item)}
                      style={({ pressed }) => [
                        styles.option,
                        {
                          backgroundColor: esSeleccionado
                            ? colors.primaryLight
                            : pressed
                              ? colors.borderLight
                              : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          {
                            color: esSeleccionado
                              ? colors.primary
                              : colors.text,
                            fontWeight: esSeleccionado
                              ? FontWeight.semibold
                              : FontWeight.regular,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                      {item.badge && (
                        <Badge label={item.badge} color={colors.textTertiary} />
                      )}
                      {esSeleccionado && (
                        <Ionicons
                          name="checkmark"
                          size={scale(18)}
                          color={colors.primary}
                        />
                      )}
                    </Pressable>
                  );
                }}
              />
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginBottom: scale(2),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  inputText: {
    fontSize: FontSize.md,
    flex: 1,
  },
  error: {
    fontSize: FontSize.xs,
    marginTop: scale(2),
  },
  hint: {
    fontSize: FontSize.xs,
    marginTop: scale(2),
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    maxHeight: '70%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    paddingVertical: scale(0),
  },
  list: {
    maxHeight: scale(400),
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.xl,
    fontSize: FontSize.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  optionText: {
    fontSize: FontSize.md,
    flex: 1,
  },
});
