import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OtpRequestScreen from '../screens/OtpRequestScreen';
import OtpVerifyScreen from '../screens/OtpVerifyScreen';

const Stack = createNativeStackNavigator();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OtpRequest" component={OtpRequestScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} options={{ headerShown: true, title: '' }} />
    </Stack.Navigator>
  );
}

export default AuthStack;
