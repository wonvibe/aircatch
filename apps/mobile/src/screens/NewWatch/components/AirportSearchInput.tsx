import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { airportsApi } from '../../../api/airports';
import { Airport } from '../../../api/types';
import { colors, radius, spacing, typography } from '../../../theme/tokens';

interface Props {
  label: string;
  value: Airport | null;
  onChange: (airport: Airport) => void;
  error?: string;
}

function displayLabel(airport: Airport): string {
  return `${airport.city} (${airport.iataCode})`;
}

export function AirportSearchInput({ label, value, onChange, error }: Props) {
  const [query, setQuery] = useState(value ? displayLabel(value) : '');
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Every state update below runs inside the debounce callback (never
    // synchronously in the effect body) — including the "bail out" case —
    // so a fast typist can't pile up cascading renders on every keystroke.
    debounceRef.current = setTimeout(() => {
      const isCurrentSelection = value && query === displayLabel(value);
      if (query.trim().length < 2 || isCurrentSelection) {
        setResults([]);
        return;
      }

      setLoading(true);
      airportsApi
        .search(query.trim())
        .then(setResults)
        .catch((err) => {
          console.warn('[AirportSearchInput] search failed:', (err as Error).message);
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, value]);

  const select = (airport: Airport) => {
    onChange(airport);
    setQuery(displayLabel(airport));
    setOpen(false);
    setResults([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder="도시 또는 공항명 검색 (예: 방콕)"
        placeholderTextColor={colors.textTertiary}
        value={query}
        onFocus={() => setOpen(true)}
        onChangeText={(text) => {
          setQuery(text);
          setOpen(true);
        }}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}

      {open && (loading || results.length > 0) && (
        <View style={styles.dropdown}>
          {loading && <Text style={styles.dropdownInfo}>검색 중…</Text>}
          {!loading &&
            results.map((airport) => (
              <Pressable key={airport.iataCode} style={styles.option} onPress={() => select(airport)}>
                <Text style={styles.optionCity}>{displayLabel(airport)}</Text>
                <Text style={styles.optionName}>{airport.name}</Text>
              </Pressable>
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodySecondary,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  dropdown: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  dropdownInfo: {
    ...typography.caption,
    padding: spacing.sm,
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionCity: {
    ...typography.body,
  },
  optionName: {
    ...typography.caption,
  },
});
