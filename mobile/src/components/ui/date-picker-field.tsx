import { useCallback, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { formatDateShort } from '@/utils/formatters';
import { useTheme } from '@/components/ui/theme-provider';

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  error?: string;
}

export default function DatePickerField({ label, value, onChange, error }: DatePickerFieldProps) {
  const { colorScheme, colors } = useTheme();
  const webInputRef = useRef<HTMLInputElement>(null);
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  });

  const currentDate = (() => {
    const d = value ? new Date(value) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  })();

  const displayValue = value ? formatDateShort(value) : '';

  const handlePress = useCallback(() => {
    if (Platform.OS === 'web') {
      webInputRef.current?.showPicker();
      return;
    }
    setTempDate(currentDate);
    setShow(true);
  }, [currentDate]);

  const handleChange = useCallback(
    (_: any, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShow(false);
        if (selectedDate) {
          const y = selectedDate.getFullYear();
          const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
          const d = String(selectedDate.getDate()).padStart(2, '0');
          onChange(`${y}-${m}-${d}`);
        }
      } else {
        if (selectedDate) setTempDate(selectedDate);
      }
    },
    [onChange],
  );

  const handleConfirm = useCallback(() => {
    setShow(false);
    const y = tempDate.getFullYear();
    const m = String(tempDate.getMonth() + 1).padStart(2, '0');
    const d = String(tempDate.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
  }, [tempDate, onChange]);

  const handleCancel = useCallback(() => {
    setShow(false);
  }, []);

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      )}
      <Pressable
        onPress={handlePress}
        style={[
          styles.wrapper,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: error ? colors.error : colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.text,
            { color: value ? colors.text : colors.textTertiary },
          ]}
        >
          {displayValue || 'Seleccionar fecha'}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={colors.textTertiary} />
      </Pressable>
      {Platform.OS === 'web' && (
        <input
          ref={webInputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ display: 'none' }}
        />
      )}
      {error && (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide" onRequestClose={handleCancel}>
          <View style={modalStyles.overlay}>
              <Pressable style={[modalStyles.backdrop, { backgroundColor: colors.overlay }]} onPress={handleCancel} />
            <View style={[modalStyles.sheet, { backgroundColor: colors.surfaceElevated }]}>
              <View style={[modalStyles.header, { borderBottomColor: colors.border }]}>
                <Pressable onPress={handleCancel}>
                  <Text style={[modalStyles.cancel, { color: colors.textSecondary }]}>
                    Cancelar
                  </Text>
                </Pressable>
                <Text style={[modalStyles.title, { color: colors.text }]}>
                  {label}
                </Text>
                <Pressable onPress={handleConfirm}>
                  <Text style={[modalStyles.confirm, { color: colors.primary }]}>
                    OK
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleChange}
                locale="es-DO"
                themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  text: {
    fontSize: FontSize.md,
    flex: 1,
  },
  error: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  cancel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  confirm: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
