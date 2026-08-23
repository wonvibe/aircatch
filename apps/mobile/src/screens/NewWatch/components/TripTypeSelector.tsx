import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TripType } from '../../../api/types';
import { colors, radius, spacing, typography } from '../../../theme/tokens';

const OPTIONS: { value: TripType; label: string }[] = [
  { value: 'one_way', label: '편도' },
  { value: 'round_trip', label: '왕복' },
  { value: 'multi_city', label: '다구간' },
];

interface Props {
  value: TripType;
  onChange: (value: TripType) => void;
}

export function TripTypeSelector({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  option: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  optionSelected: {
    backgroundColor: colors.white,
  },
  optionText: {
    ...typography.bodySecondary,
  },
  optionTextSelected: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
