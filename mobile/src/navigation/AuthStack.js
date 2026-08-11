import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OtpRequestScreen from '../screens/OtpRequestScreen';
import OtpVerifyScreen from '../screens/OtpVerifyScreen';

const Stack = createNativeStackNavigator();

/**
 * Pre-auth OTP flow only. What happens right after OTP verification succeeds — the first-run
 * privacy notice + language/notifications/app-lock onboarding sequence, or a direct jump to
 * Home for a returning device — is decided by RootNavigator (see App.js) based on the
 * 'onboardingComplete' AsyncStorage flag, via OnboardingContext/OnboardingStack. That logic
 * doesn't live in this stack because it depends on `isAuthenticated` flipping true, which
 * unmounts this stack entirely.
 */
export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OtpRequest" component={OtpRequestScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} options={{ headerShown: true, title: '' }} />
    </Stack.Navigator>
  );
}

export default AuthStack;
