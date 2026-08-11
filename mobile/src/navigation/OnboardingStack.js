import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PrivacyNoticeScreen from '../screens/PrivacyNoticeScreen';
import OnboardingPreferencesScreen from '../screens/OnboardingPreferencesScreen';
import PinSetupScreen from '../screens/PinSetupScreen';

const Stack = createNativeStackNavigator();

/**
 * First-run onboarding sequence, rendered by RootNavigator in place of MainTabs for an
 * authenticated patient who hasn't completed it on this device yet (spec: "Privacy notice
 * (Gu/Hi/En, layered) → {Acknowledge} → {Language}{Notification permission}{Optional
 * biometric/app lock} → account linked to MRN → Home"). "Account linked to MRN" already
 * happened server-side during OTP verification; this stack is the remaining device-side setup
 * before landing on Home.
 */
export function OnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PrivacyNotice" component={PrivacyNoticeScreen} />
      <Stack.Screen name="OnboardingPreferences" component={OnboardingPreferencesScreen} />
      <Stack.Screen name="PinSetup" component={PinSetupScreen} initialParams={{ fromOnboarding: true }} />
    </Stack.Navigator>
  );
}

export default OnboardingStack;
