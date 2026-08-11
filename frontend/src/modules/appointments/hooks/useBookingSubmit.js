import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAppointmentMutations } from './useAppointments';

/**
 * Single booking submit path shared by the guided BookingWizard and the
 * one-screen QuickBookingPanel. Uses the same `create` mutation, so the
 * scheduling engine still re-validates the slot server-side and the
 * "slot taken" error surfaces identically from both entry points.
 */
export function useBookingSubmit(onCreated) {
  const { t } = useTranslation();
  const { create } = useAppointmentMutations();

  const submit = async ({
    branchId,
    doctorId,
    serviceId,
    patientId,
    date,
    slot,
    reasonForVisit,
    notes,
    // `WALK_IN` is only correct for the literal walk-in dialog — the guided BookingWizard /
    // QuickBookingPanel are the receptionist booking something at the front desk (in person or
    // over the phone) rather than a patient physically walking up without an appointment, so
    // `PHONE` is the more honest default for every OTHER caller of this shared submit path.
    source = 'PHONE',
    appointmentType = 'CONSULTATION',
  }) => {
    try {
      const res = await create.mutateAsync({
        branchId,
        doctorId,
        serviceId,
        patientId,
        appointmentDate: date,
        startTime: slot.start,
        endTime: slot.end,
        reasonForVisit: reasonForVisit || null,
        notes: notes || null,
        source,
        appointmentType,
      });
      toast.success(
        t('appointments.wizard.toastBooked', 'Booked {{number}}', {
          number: res.data.appointment.appointmentNumber,
        })
      );
      onCreated?.(res.data.appointment);
      return res.data.appointment;
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          t('appointments.wizard.bookingFailed', 'Booking failed — slot may be unavailable')
      );
      return null;
    }
  };

  return { submit, isPending: create.isPending };
}

export default useBookingSubmit;
