import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface SearchBarProps {
  value: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export default function SearchBar({
  value,
  onSearch,
  placeholder = 'Buscar...',
  debounceMs = 400,
}: SearchBarProps) {
  const { colorScheme, colors } = useTheme();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onSearch);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    callbackRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleChange = (text: string) => {
    setLocalValue(text);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      callbackRef.current(text);
    }, debounceMs);
  };

  const handleClear = () => {
    setLocalValue('');

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    callbackRef.current('');
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      <Ionicons
        name="search"
        size={20}
        color={colors.textTertiary}
        style={styles.icon}
      />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        value={localValue}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        returnKeyType="search"
      />
      {localValue.length > 0 && (
        <Pressable onPress={handleClear} hitSlop={8} style={styles.clearButton}>
          <Ionicons
            name="close-circle"
            size={20}
            color={colors.textTertiary}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: FontSize.md,
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
