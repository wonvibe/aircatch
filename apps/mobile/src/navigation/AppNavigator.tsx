import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { NewWatchScreen } from '../screens/NewWatch/NewWatchScreen';
import { PriceDetailScreen } from '../screens/PriceDetail/PriceDetailScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicy/PrivacyPolicyScreen';
import { AppStackParamList } from './types';
import { colors } from '../theme/tokens';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="NewWatch"
        component={NewWatchScreen}
        options={{ presentation: 'modal', title: '새 알림 등록' }}
      />
      <Stack.Screen name="PriceDetail" component={PriceDetailScreen} options={{ title: '가격 추이' }} />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ title: '개인정보처리방침' }}
      />
    </Stack.Navigator>
  );
}
