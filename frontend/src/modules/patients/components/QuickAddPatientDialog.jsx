import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { BranchPicker } from '@/modules/appointments/components/bookingPickers';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants/rbac';
import { usePatientMutations } from '../hooks/usePatients';

// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

/**
 * Minimum-required inline patient registration — the "patient doesn't exist yet" branch of
 * booking flows described across the flow docs (receptionist Add Appointment §1, walk-in
 * check-in, etc.): "possible duplicate detected → review candidates → confirm 'New patient' or
 * pick existing (no auto-merge)". This dialog is the reusable implementation of that branch —
 * ANY picker that lets staff choose a patient (booking wizard, quick-booking panel, walk-in
 * dialog, treatment/prescription "for consultation" flows) can mount this instead of forcing
 * staff to abandon the in-progress form, navigate to the full Patients → Add page, fill it out,
 * then navigate back and re-pick everything they'd already chosen.
 *
 * Deliberately NOT the full `PatientForm` — only firstName/lastName/mobile/gender are actually
 * required by `createPatientSchema` server-side (see backend/src/validators/patient.validator.js);
 * everything else on the full form (address, medical history, documents, consent details) is
 * exactly the kind of detail that can be filled in later from the patient's own record, per the
 * same "minimum-required first" principle the flow docs describe. `defaultBranchId` lets the
 * calling picker pass through whatever branch is already selected in the surrounding form so the
 * receptionist isn't asked to pick it twice.
 */
// A typed search query like "Ravi Patel" is a reasonable first/last-name split to pre-fill —
// the receptionist still sees and can correct both fields before submitting, this just saves
// re-typing what they already typed once into the search box.
function splitTypedName(typed) {
  const parts = typed.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function QuickAddPatientDialog({ open, onOpenChange, onCreated, defaultBranchId = '', defaultName = '' }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { create, checkDuplicates } = usePatientMutations();

  // A branch-scoped receptionist/staff member only ever registers patients at their own branch
  // (the backend enforces this on create regardless) — lock it rather than making them pick,
  // same reasoning as the booking wizard's branch step. Owner/Admin keep whatever branch was
  // already selected in the surrounding form.
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const ownBranchId = !isGlobalScope ? user?.branch || '' : '';
  const lockBranch = Boolean(ownBranchId);
  const initialBranchId = ownBranchId || defaultBranchId;
  // Cached by the same query key BranchPicker/other pickers already use elsewhere on this
  // page — this doesn't add a second network round-trip in practice.
  const { data: branchesData } = useBranchList({ limit: 50 });
  const ownBranchName = branchesData?.items?.find((b) => b.id === ownBranchId)?.displayName
    || branchesData?.items?.find((b) => b.id === ownBranchId)?.name;

  const [firstName, setFirstName] = useState(() => splitTypedName(defaultName).firstName);
  const [lastName, setLastName] = useState(() => splitTypedName(defaultName).lastName);
  const [mobile, setMobile] = useState('');
  const [gender, setGender] = useState('FEMALE');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [branchId, setBranchId] = useState(initialBranchId);
  const [sourceCategory, setSourceCategory] = useState('');
  const [sourceOtherText, setSourceOtherText] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [consent, setConsent] = useState({
    privacyPolicy: false,
    treatmentConsent: false,
    communicationConsent: false,
    marketingConsent: false,
    photographyConsent: false,
  });
  const [duplicates, setDuplicates] = useState(null);

  const isReferral = ['PERSON_REFERRAL', 'PATIENT_REFERRAL', 'DOCTOR_REFERRAL'].includes(sourceCategory);

  const reset = () => {
    const split = splitTypedName(defaultName);
    setFirstName(split.firstName);
    setLastName(split.lastName);
    setMobile('');
    setGender('FEMALE');
    setDateOfBirth('');
    setBranchId(initialBranchId);
    setSourceCategory('');
    setSourceOtherText('');
    setReferredBy('');
    setConsent({
      privacyPolicy: false,
      treatmentConsent: false,
      communicationConsent: false,
      marketingConsent: false,
      photographyConsent: false,
    });
    setDuplicates(null);
  };

  // Dialog stays mounted (`open` only toggles visibility) — sync the name split to whatever the
  // receptionist had already typed in the search box each time it's actually opened.
  useEffect(() => {
    if (open) {
      const split = splitTypedName(defaultName);
      setFirstName(split.firstName);
      setLastName(split.lastName);
      setBranchId(initialBranchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultName, initialBranchId]);

  const canSubmit = firstName.trim() && lastName.trim() && mobile.trim() && branchId
    && (sourceCategory !== 'OTHER' || sourceOtherText.trim());

  const doCreate = async (allowDuplicate = false) => {
    try {
      const res = await create.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile: mobile.trim(),
        gender,
        dateOfBirth: dateOfBirth || undefined,
        primaryBranchId: branchId,
        sourceCategory: sourceCategory || undefined,
        sourceOtherText: sourceCategory === 'OTHER' ? sourceOtherText.trim() || undefined : undefined,
        referredBy: isReferral ? referredBy.trim() || undefined : undefined,
        consent,
        allowDuplicate,
      });
      const patient = res.data.patient;
      toast.success(t('patients.quickAdd.created', 'Patient registered · {{mrn}}', { mrn: patient.mrn }));
      onCreated(patient);
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('patients.quickAdd.createFailed', 'Failed to register patient'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    // Same advisory duplicate check the full registration page uses — surface the candidates
    // and let staff confirm "new patient" or cancel to search again, never silently auto-merge.
    try {
      const dupRes = await checkDuplicates.mutateAsync({ mobile: mobile.trim(), firstName: firstName.trim(), lastName: lastName.trim() });
      const matches = dupRes?.data?.matches || [];
      if (matches.length && !duplicates) {
        setDuplicates(matches);
        return;
      }
    } catch {
      /* duplicate check is advisory — never block registration on it failing */
    }
    await doCreate(Boolean(duplicates));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('patients.quickAdd.title', 'Add new patient')}</DialogTitle>
          <DialogDescription>
            {t('patients.quickAdd.description', "Register the essentials now — the rest of the patient's record can be filled in later.")}
          </DialogDescription>
        </DialogHeader>

        {duplicates ? (
          <div className="space-y-3">
            <p className="text-sm text-warning">
              {t('patients.quickAdd.duplicateWarning', '{{count}} possible duplicate(s) found — confirm this is a new patient, not one of these.', { count: duplicates.length })}
            </p>
            <ul className="space-y-1 rounded-md border p-2 text-sm">
              {duplicates.map(({ patient: p }) => (
                <li key={p.id} className="text-muted-foreground">
                  {p.mrn} · {p.fullName} · {p.mobile}
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDuplicates(null)}>
                {t('patients.quickAdd.reviewAgain', 'Back — let me check again')}
              </Button>
              <Button type="button" disabled={create.isPending} onClick={() => doCreate(true)}>
                {create.isPending
                  ? t('patients.quickAdd.registering', 'Registering…')
                  : t('patients.quickAdd.confirmNewPatient', 'Confirm — this is a new patient')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t('patients.form.firstName', 'First name')}</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>{t('patients.form.lastName', 'Last name')}</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>{t('patients.form.mobile', 'Mobile')}</Label>
                <Input value={mobile} onChange={(e) => setMobile(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>{t('patients.form.gender', 'Gender')}</Label>
                <Select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="FEMALE">{t('patients.form.genderFemale', 'Female')}</option>
                  <option value="MALE">{t('patients.form.genderMale', 'Male')}</option>
                  <option value="OTHER">{t('patients.form.genderOther', 'Other')}</option>
                  <option value="PREFER_NOT_TO_SAY">{t('patients.form.genderUnspecified', 'Prefer not to say')}</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t('patients.form.dateOfBirth', 'Date of birth')}</Label>
                <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{t('patients.form.branch', 'Branch')}</Label>
                {lockBranch ? (
                  <p className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                    {ownBranchName || t('patients.quickAdd.yourBranch', 'Your branch')}
                  </p>
                ) : (
                  <BranchPicker value={branchId} onChange={setBranchId} />
                )}
              </div>
              <div className="space-y-1">
                <Label>{t('patients.form.source', 'Source')}</Label>
                <Select value={sourceCategory} onChange={(e) => setSourceCategory(e.target.value)}>
                  <option value="">{t('patients.form.selectSource', 'Select source')}</option>
                  <option value="GOOGLE">{t('patients.source.GOOGLE', 'Google')}</option>
                  <option value="WEBSITE">{t('patients.source.WEBSITE', 'Website')}</option>
                  <option value="FACEBOOK_AD">{t('patients.source.FACEBOOK_AD', 'Facebook Ad')}</option>
                  <option value="INSTAGRAM_AD">{t('patients.source.INSTAGRAM_AD', 'Instagram Ad')}</option>
                  <option value="WHATSAPP">{t('patients.source.WHATSAPP', 'WhatsApp')}</option>
                  <option value="WALK_IN">{t('patients.source.WALK_IN', 'Walk-in')}</option>
                  <option value="PERSON_REFERRAL">{t('patients.source.PERSON_REFERRAL', 'Person referral')}</option>
                  <option value="PATIENT_REFERRAL">{t('patients.source.PATIENT_REFERRAL', 'Patient referral')}</option>
                  <option value="DOCTOR_REFERRAL">{t('patients.source.DOCTOR_REFERRAL', 'Doctor referral')}</option>
                  <option value="EVENT">{t('patients.source.EVENT', 'Event')}</option>
                  <option value="OTHER">{t('patients.source.OTHER', 'Other')}</option>
                </Select>
              </div>
              {sourceCategory === 'OTHER' && (
                <div className="space-y-1 sm:col-span-2">
                  <Label>{t('patients.form.sourceOtherText', 'Please specify source')}</Label>
                  <Input
                    value={sourceOtherText}
                    onChange={(e) => setSourceOtherText(e.target.value)}
                    required
                  />
                </div>
              )}
              {isReferral && (
                <div className="space-y-1 sm:col-span-2">
                  <Label>{t('patients.form.referredBy', 'Referrer (patient/person) or referral code')}</Label>
                  <Input value={referredBy} onChange={(e) => setReferredBy(e.target.value)} />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('patients.form.consents', 'Consents')}</Label>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={consent.privacyPolicy}
                    onChange={(e) => setConsent((c) => ({ ...c, privacyPolicy: e.target.checked }))}
                  />
                  {t('patients.form.consentData', 'Data consent')}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={consent.treatmentConsent}
                    onChange={(e) => setConsent((c) => ({ ...c, treatmentConsent: e.target.checked }))}
                  />
                  {t('patients.form.consentTreatment', 'Treatment consent')}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={consent.communicationConsent}
                    onChange={(e) => setConsent((c) => ({ ...c, communicationConsent: e.target.checked }))}
                  />
                  {t('patients.form.consentCommunication', 'Communication consent')}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={consent.marketingConsent}
                    onChange={(e) => setConsent((c) => ({ ...c, marketingConsent: e.target.checked }))}
                  />
                  {t('patients.form.consentMarketing', 'Marketing consent')}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={consent.photographyConsent}
                    onChange={(e) => setConsent((c) => ({ ...c, photographyConsent: e.target.checked }))}
                  />
                  {t('patients.form.consentPhoto', 'Photo consent')}
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={!canSubmit || create.isPending || checkDuplicates.isPending}>
                {create.isPending || checkDuplicates.isPending
                  ? t('patients.quickAdd.registering', 'Registering…')
                  : t('patients.quickAdd.register', 'Register & select')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default QuickAddPatientDialog;
