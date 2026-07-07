import { forwardRef, useCallback, useState } from 'react';
import { type TextInputProps, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { formatCedula, formatIngresosInput, formatPhone } from '@/utils/formatters';
import { useTheme } from '@/components/ui/theme-provider';

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  prefix?: string;
  format?: 'cedula' | 'phone' | 'currency' | 'none';
  hint?: string;
  rightIcon?: React.ReactNode;
}

export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInput({
  label,
  error,
  prefix,
  format = 'none',
  hint,
  rightIcon,
  style,
  onChangeText,
  value,
  multiline,
  secureTextEntry,
  ...props
}: AppInputProps, ref) {
  const { colorScheme, colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(!!secureTextEntry);

  const handleChangeText = useCallback(
    (text: string) => {
      if (!onChangeText) return;
      if (format === 'cedula') {
        onChangeText(formatCedula(text));
      } else if (format === 'phone') {
        onChangeText(formatPhone(text));
      } else if (format === 'currency') {
        onChangeText(formatIngresosInput(text));
      } else {
        onChangeText(text);
      }
    },
    [format, onChangeText],
  );

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          multiline && styles.inputWrapperMultiline,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: error
              ? colors.error
              : isFocused
                ? colors.primary
                : colors.border,
          },
        ]}
      >
        {prefix && (
          <Text style={[styles.prefix, { color: colors.textTertiary }]}>
            {prefix}
          </Text>
        )}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            { color: colors.text },
            multiline && styles.inputMultiline,
            prefix && styles.inputWithPrefix,
            secureTextEntry && styles.inputWithEye,
            style,
          ]}
          placeholderTextColor={colors.textTertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          value={value}
          onChangeText={handleChangeText}
          multiline={multiline}
          secureTextEntry={isSecure}
          {...props}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setIsSecure((prev) => !prev)}
            hitSlop={8}
            accessibilityLabel={isSecure ? 'Mostrar contraseña' : 'Ocultar contraseña'}
          >
            <Ionicons
              name={isSecure ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textTertiary}
            />
          </Pressable>
        )}
        {rightIcon && !secureTextEntry && (
          <View style={styles.rightIcon}>{rightIcon}</View>
        )}
      </View>
      {error && (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      )}
      {hint && !error && (
        <Text style={[styles.hint, { color: colors.textTertiary }]}>{hint}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  prefix: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    marginRight: Spacing.xs,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: FontSize.md,
    paddingVertical: 0,
  },
  inputWrapperMultiline: {
    height: undefined,
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
  },
  inputMultiline: {
    height: undefined,
    minHeight: 100,
    textAlignVertical: 'top',
    paddingVertical: 0,
  },
  inputWithPrefix: {
    marginLeft: 0,
  },
  inputWithEye: {
    marginRight: Spacing.xs,
  },
  error: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  hint: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  rightIcon: {
    marginLeft: Spacing.xs,
  },
});
