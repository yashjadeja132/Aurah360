import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import DocumentsScreen from '../screens/DocumentsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import OffersScreen from '../screens/OffersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TimelineScreen from '../screens/TimelineScreen';
import PinSetupScreen from '../screens/PinSetupScreen';
import { headerTitleFor } from '../components/HeaderTitle';

const Stack = createNativeStackNavigator();

/** The last tab's root is Profile (identity + dependents + quick links) — matches every other
 *  tab landing directly on its own screen rather than a generic menu. Documents/Notifications/
 *  Offers/Timeline/Settings are pushed from Profile's quick-link list with a back button and
 *  their own title+subtitle via `headerTitleFor`. The route stays named "More" in MainTabs.js
 *  since HomeScreen's quick actions already call `navigation.navigate('More', { screen })`. */
export function MoreStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{ headerTitle: headerTitleFor(t('documents.title'), t('documents.subtitle')) }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerTitle: headerTitleFor(t('notifications.title'), t('notifications.subtitle')) }}
      />
      <Stack.Screen
        name="Offers"
        component={OffersScreen}
        options={{ headerTitle: headerTitleFor(t('offers.title'), t('offers.subtitle')) }}
      />
      <Stack.Screen
        name="Timeline"
        component={TimelineScreen}
        options={{ headerTitle: headerTitleFor(t('timeline.title'), t('timeline.subtitle')) }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerTitle: headerTitleFor(t('settings.title'), t('settings.subtitle')) }}
      />
      <Stack.Screen
        name="PinSetup"
        component={PinSetupScreen}
        options={{ title: t('pin.setupTitle') }}
      />
    </Stack.Navigator>
  );
}

export default MoreStack;
