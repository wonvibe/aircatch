import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AirportSearchInput } from './AirportSearchInput';
import { DateField } from './DateField';
import { Airport } from '../../../api/types';
import { colors, radius, spacing, typography } from '../../../theme/tokens';

export interface SegmentDraft {
  origin: Airport | null;
  destination: Airport | null;
  date: Date;
}

interface Props {
  segments: SegmentDraft[];
  onChange: (segments: SegmentDraft[]) => void;
  minDate: Date;
  maxDate: Date;
}

const MIN_SEGMENTS = 2;

export function MultiCitySegmentList({ segments, onChange, minDate, maxDate }: Props) {
  const update = (index: number, patch: Partial<SegmentDraft>) => {
    onChange(segments.map((segment, i) => (i === index ? { ...segment, ...patch } : segment)));
  };

  const addSegment = () => {
    onChange([...segments, { origin: null, destination: null, date: minDate }]);
  };

  const removeSegment = (index: number) => {
    if (segments.length <= MIN_SEGMENTS) return;
    onChange(segments.filter((_, i) => i !== index));
  };

  return (
    <View>
      {segments.map((segment, index) => (
        <View key={index} style={styles.segment}>
          <View style={styles.segmentHeader}>
            <Text style={styles.segmentTitle}>구간 {index + 1}</Text>
            {segments.length > MIN_SEGMENTS && (
              <Pressable onPress={() => removeSegment(index)}>
                <Text style={styles.removeText}>삭제</Text>
              </Pressable>
            )}
          </View>
          <AirportSearchInput
            label="출발"
            value={segment.origin}
            onChange={(airport) => update(index, { origin: airport })}
          />
          <AirportSearchInput
            label="도착"
            value={segment.destination}
            onChange={(airport) => update(index, { destination: airport })}
          />
          <DateField
            label="출발일"
            value={segment.date}
            minimumDate={minDate}
            maximumDate={maxDate}
            onChange={(date) => update(index, { date })}
          />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={addSegment}>
        <Text style={styles.addButtonText}>+ 구간 추가</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  segmentTitle: {
    ...typography.subtitle,
  },
  removeText: {
    ...typography.bodySecondary,
    color: colors.danger,
  },
  addButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addButtonText: {
    ...typography.bodySecondary,
    color: colors.accentBlue,
  },
});
