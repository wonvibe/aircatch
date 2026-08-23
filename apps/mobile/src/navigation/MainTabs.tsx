import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { DashboardScreen } from '../screens/Dashboard/DashboardScreen';
import { NotificationHistoryScreen } from '../screens/NotificationHistory/NotificationHistoryScreen';
import { MainTabParamList } from './types';
import { colors } from '../theme/tokens';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentBlue,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.background },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: '대시보드', tabBarIcon: ({ color }) => <TabIcon symbol="✈️" color={color} /> }}
      />
      <Tab.Screen
        name="NotificationHistory"
        component={NotificationHistoryScreen}
        options={{ title: '알림', tabBarIcon: ({ color }) => <TabIcon symbol="🔔" color={color} /> }}
      />
    </Tab.Navigator>
  );
}

function TabIcon({ symbol, color }: { symbol: string; color: string }) {
  return <Text style={{ fontSize: 18, color }}>{symbol}</Text>;
}
