import { useCallback, useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { PushPermissionBanner } from '../../components/PushPermissionBanner';
import { WatchCard } from './components/WatchCard';
import { useWatchesStore } from '../../store/useWatchesStore';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { MainTabScreenProps } from '../../navigation/types';

export function DashboardScreen({ navigation }: MainTabScreenProps<'Dashboard'>) {
  const { watches, loading, error, fetchAll } = useWatchesStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Re-fetch whenever the tab regains focus (e.g. after creating a watch or
  // coming back from the price detail screen).
  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={typography.title}>내 여정</Text>
      </View>

      <PushPermissionBanner />

      {loading && watches.length === 0 && <LoadingState />}
      {!loading && error && watches.length === 0 && <ErrorState message={error} onRetry={fetchAll} />}
      {!loading && !error && watches.length === 0 && (
        <EmptyState
          title="등록된 여정이 없어요"
          description="오른쪽 아래 + 버튼으로 첫 특가 알림을 등록해보세요."
        />
      )}

      <FlatList
        data={watches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={fetchAll}
        renderItem={({ item }) => (
          <WatchCard watch={item} onPress={() => navigation.navigate('PriceDetail', { watchId: item.id })} />
        )}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('NewWatch')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: spacing.md,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabIcon: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '600',
    marginTop: -2,
  },
});
