/**
 * Aurah 360 ClinicOS — patient mobile app (React Native + JavaScript + Metro).
 * OTP-only authentication (APP-002); released records only (§13.2); no clinical data in
 * crash/analytics logs (APP-008) — this file and its screens never log patient identifiers.
 */
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import i18next, { initI18n } from './src/i18n';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { DependentsProvider } from './src/context/DependentsContext';
import { AppLockProvider, useAppLock } from './src/context/AppLockContext';
import { NotificationsBadgeProvider } from './src/context/NotificationsBadgeContext';
import { AuthStack } from './src/navigation/AuthStack';
import { MainTabs } from './src/navigation/MainTabs';
import PinLockScreen from './src/screens/PinLockScreen';
import { SplashScreen } from './src/components/SplashScreen';

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isLocked } = useAppLock();

  if (isLoading) {
    return <SplashScreen />;
  }

  // The PIN lock only makes sense once a session already exists — it gates re-entry into an
  // authenticated app, not the OTP sign-in flow itself.
  if (isAuthenticated && isLocked) {
    return (
      <NavigationContainer>
        <PinLockScreen />
      </NavigationContainer>
    );
  }

  return <NavigationContainer>{isAuthenticated ? <MainTabs /> : <AuthStack />}</NavigationContainer>;
}

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady) return <SplashScreen />;

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18next}>
        <AuthProvider>
          <DependentsProvider>
            <NotificationsBadgeProvider>
              <AppLockProvider>
                <RootNavigator />
              </AppLockProvider>
            </NotificationsBadgeProvider>
          </DependentsProvider>
        </AuthProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}
