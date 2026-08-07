import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const branchFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  branchCode: z.string().min(2, 'Code is required').max(20),
  displayName: z.string().min(1, 'Display name is required'),
  email: z.string().email(),
  phone: z.string().min(8, 'Phone is required'),
  alternatePhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  workingHours: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export function BranchForm({ mode = 'create', defaultValues, onSubmit, isSubmitting }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      name: '',
      branchCode: '',
      displayName: '',
      email: '',
      phone: '',
      alternatePhone: '',
      address: '',
      city: 'Surat',
      state: 'Gujarat',
      country: 'India',
      postalCode: '',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      workingHours: '10:00 - 19:00',
      notes: '',
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <Input {...register('name')} />
        </Field>
        <Field label="Branch code" error={errors.branchCode}>
          <Input {...register('branchCode')} disabled={mode === 'edit'} />
        </Field>
        <Field label="Display name" error={errors.displayName}>
          <Input {...register('displayName')} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" {...register('email')} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input {...register('phone')} />
        </Field>
        <Field label="Alternate phone">
          <Input {...register('alternatePhone')} />
        </Field>
      </div>

      <Field label="Address">
        <Input {...register('address')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="City"><Input {...register('city')} /></Field>
        <Field label="State"><Input {...register('state')} /></Field>
        <Field label="Country"><Input {...register('country')} /></Field>
        <Field label="Postal code"><Input {...register('postalCode')} /></Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Timezone"><Input {...register('timezone')} /></Field>
        <Field label="Currency"><Input {...register('currency')} /></Field>
        <Field label="Working hours"><Input {...register('workingHours')} /></Field>
      </div>

      <Field label="Notes">
        <Input {...register('notes')} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create branch' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
    </div>
  );
}

export default BranchForm;
