import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthScreen } from '../screens/Auth/AuthScreen';
import { AppNavigator } from './AppNavigator';
import { ScreenContainer } from '../components/ScreenContainer';
import { LoadingState } from '../components/StateViews';
import { useAuthStore } from '../store/useAuthStore';

export function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const initializing = useAuthStore((s) => s.initializing);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  if (initializing) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return <NavigationContainer>{session ? <AppNavigator /> : <AuthScreen />}</NavigationContainer>;
}
