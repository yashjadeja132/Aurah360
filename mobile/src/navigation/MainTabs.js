import React from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Home, CalendarDays, Stethoscope, Receipt, User } from 'lucide-react-native';
import HomeScreen from '../screens/HomeScreen';
import AppointmentsStack from './AppointmentsStack';
import TreatmentsScreen from '../screens/TreatmentsScreen';
import BillsScreen from '../screens/BillsScreen';
import MoreStack from './MoreStack';
import { useNotificationsBadge } from '../context/NotificationsBadgeContext';
import { colors, radii } from '../theme/colors';

const Tab = createBottomTabNavigator();

const ICONS = { Home, Appointments: CalendarDays, Treatments: Stethoscope, Bills: Receipt, More: User };

function TabIcon({ route, focused }) {
  const Icon = ICONS[route.name];
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Icon size={20} color={focused ? colors.primary : colors.mutedForeground} strokeWidth={2.1} />
    </View>
  );
}

function TabLabel({ label, focused }) {
  return <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>;
}

export function MainTabs() {
  const { t } = useTranslation();
  const { unreadCount } = useNotificationsBadge();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarIcon: ({ focused }) => <TabIcon route={route} focused={focused} />,
        tabBarLabel: ({ focused, children }) => <TabLabel label={children} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('nav.home') }} />
      <Tab.Screen name="Appointments" component={AppointmentsStack} options={{ tabBarLabel: t('nav.appointments') }} />
      <Tab.Screen name="Treatments" component={TreatmentsScreen} options={{ tabBarLabel: t('nav.treatments') }} />
      <Tab.Screen name="Bills" component={BillsScreen} options={{ tabBarLabel: t('nav.bills') }} />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{ tabBarLabel: t('profile.title'), tabBarBadge: unreadCount > 0 ? unreadCount : undefined }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  tabItem: { paddingTop: 2 },
  iconWrap: {
    width: 40,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.successSoft },
  label: { fontSize: 11.5, fontWeight: '600', color: colors.mutedForeground, marginTop: 2 },
  labelActive: { color: colors.primary, fontWeight: '700' },
});

export default MainTabs;
