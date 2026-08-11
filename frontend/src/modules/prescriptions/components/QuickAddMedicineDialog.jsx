import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { prescriptionsApi } from '../api/prescriptionsApi';

/**
 * Inline "the drug I need isn't in the catalog yet" — same pattern as
 * QuickAddPatientDialog (see that file's docblock), applied to the medicine catalog a doctor
 * searches while writing a prescription. `name` is the only field `createMedicineSchema`
 * actually requires (backend/src/validators/prescription.validator.js) — genericName/brand/
 * strength are optional here and can be filled in later from the full Masters record; this is
 * NOT the branch-stock ("can I actually dispense this today") picker in the pharmacy dispense
 * screen, which stays a separate, deliberately-not-inline flow since creating a stock record
 * with zero real quantity wouldn't let anyone dispense anything anyway.
 */
export function QuickAddMedicineDialog({ open, onOpenChange, onCreated, defaultName = '' }) {
  const { t } = useTranslation();
  const create = useMutation({ mutationFn: prescriptionsApi.createMedicine });

  const [name, setName] = useState(defaultName);
  const [genericName, setGenericName] = useState('');
  const [strength, setStrength] = useState('');
  const [brand, setBrand] = useState('');

  const reset = () => {
    setName(defaultName);
    setGenericName('');
    setStrength('');
    setBrand('');
  };

  // Dialog stays mounted (`open` only toggles visibility) — sync the name field to whatever the
  // doctor had already typed in the search box each time it's actually opened.
  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await create.mutateAsync({
        name: name.trim(),
        genericName: genericName.trim() || undefined,
        strength: strength.trim() || undefined,
        brand: brand.trim() || undefined,
      });
      const medicine = res.data.medicine;
      toast.success(t('prescriptions.medicineSearch.created', 'Medicine added · {{name}}', { name: medicine.name }));
      onCreated(medicine);
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('prescriptions.medicineSearch.createFailed', 'Failed to add medicine'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('prescriptions.medicineSearch.addTitle', 'Add new medicine')}</DialogTitle>
          <DialogDescription>
            {t(
              'prescriptions.medicineSearch.addDescription',
              "Add it to the catalog now — composition, form and other details can be filled in later from Masters."
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>{t('prescriptions.medicineSearch.name', 'Name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t('prescriptions.medicineSearch.genericName', 'Generic name')}</Label>
              <Input value={genericName} onChange={(e) => setGenericName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t('prescriptions.medicineSearch.strength', 'Strength')}</Label>
              <Input value={strength} onChange={(e) => setStrength(e.target.value)} placeholder={t('prescriptions.medicineSearch.strengthPlaceholder', 'e.g. 500 mg')} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t('prescriptions.medicineSearch.brand', 'Brand (optional)')}</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending
                ? t('prescriptions.medicineSearch.adding', 'Adding…')
                : t('prescriptions.medicineSearch.addAndSelect', 'Add & select')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default QuickAddMedicineDialog;
