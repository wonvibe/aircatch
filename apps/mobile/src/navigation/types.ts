import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

export type AppStackParamList = {
  MainTabs: undefined;
  NewWatch: undefined;
  PriceDetail: { watchId: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  NotificationHistory: undefined;
};

// Tab screens need both their own tab navigation AND the parent stack's
// (to push NewWatch/PriceDetail, which live outside the tab bar).
export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<AppStackParamList>
>;

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>;
