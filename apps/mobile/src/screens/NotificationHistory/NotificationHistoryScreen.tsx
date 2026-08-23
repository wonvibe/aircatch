import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { NotificationItem } from './components/NotificationItem';
import { useNotificationsStore } from '../../store/useNotificationsStore';
import { spacing, typography } from '../../theme/tokens';

export function NotificationHistoryScreen() {
  const { items, loading, error, fetchFirstPage, fetchNextPage } = useNotificationsStore();

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={typography.title}>알림 내역</Text>
      </View>

      {loading && items.length === 0 && <LoadingState />}
      {!loading && error && items.length === 0 && <ErrorState message={error} onRetry={fetchFirstPage} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState title="아직 알림이 없어요" description="특가가 발견되면 여기에 기록됩니다." />
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading && items.length > 0}
        onRefresh={fetchFirstPage}
        onEndReached={fetchNextPage}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => <NotificationItem item={item} />}
      />
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
});
