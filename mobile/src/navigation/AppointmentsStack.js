import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import BookAppointmentScreen from '../screens/BookAppointmentScreen';
import RescheduleAppointmentScreen from '../screens/RescheduleAppointmentScreen';
import { headerTitleFor } from '../components/HeaderTitle';

const Stack = createNativeStackNavigator();

/** Appointments tab is nested so Book/Reschedule can push on top of the list — same
 *  pattern as MoreStack for Documents/Notifications/Offers/Profile. The list screen renders
 *  its own in-content title+subtitle (Screen's `title`/`subtitle` props); pushed screens use
 *  the native header's title+subtitle via `headerTitleFor`. */
export function AppointmentsStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AppointmentsList"
        component={AppointmentsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BookAppointment"
        component={BookAppointmentScreen}
        options={{ headerTitle: headerTitleFor(t('appointments.book'), t('appointments.selectDoctor')) }}
      />
      <Stack.Screen
        name="RescheduleAppointment"
        component={RescheduleAppointmentScreen}
        options={{ headerTitle: headerTitleFor(t('appointments.reschedule'), t('appointments.selectDate')) }}
      />
    </Stack.Navigator>
  );
}

export default AppointmentsStack;
