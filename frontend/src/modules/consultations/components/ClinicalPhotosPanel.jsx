import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { APP_CONFIG } from '@/constants/config';
import { PHOTO_TYPE_OPTIONS, PHOTO_LATERALITY_OPTIONS, RESTRICTED_BODY_REGION_HINTS } from '../constants';
import { useReleasePhoto, useUploadPhoto } from '../hooks/useConsultations';

/**
 * Nurse flow gap fix — guard sequence BEFORE the capture control unlocks:
 * patient+visit confirmed -> laterality -> purpose -> consent valid.
 * `consultationId` being present IS "patient+visit confirmed" — this panel only ever mounts
 * inside ConsultationWorkspacePage/PatientPhotosPanel once a consultation row exists, so there is
 * no separate confirmation step to add here; the guard below still refuses to proceed without it
 * defensively (e.g. panel reused somewhere that hasn't resolved an id yet).
 */
export function ClinicalPhotosPanel({ consultationId, photos = [], readOnly }) {
  const { t } = useTranslation();
  const upload = useUploadPhoto(consultationId);
  const release = useReleasePhoto(consultationId);
  const [photoType, setPhotoType] = useState('BEFORE');
  const [laterality, setLaterality] = useState('');
  const [title, setTitle] = useState('');
  const [bodyRegion, setBodyRegion] = useState('');
  const [consentVerified, setConsentVerified] = useState(false);
  const [file, setFile] = useState(null);
  const [compare, setCompare] = useState({ before: '', after: '' });

  const visitConfirmed = Boolean(consultationId);
  const purposeSelected = Boolean(photoType);
  const lateralitySelected = Boolean(laterality);
  // The capture control (file picker — camera capture is a deferred follow-up, see module notes)
  // stays locked until every guard step is satisfied, in the spec's order.
  const captureUnlocked = visitConfirmed && lateralitySelected && purposeSelected && consentVerified;

  const restrictedHint = useMemo(() => {
    const normalized = bodyRegion.trim().toLowerCase();
    if (!normalized) return false;
    return RESTRICTED_BODY_REGION_HINTS.some((term) => normalized.includes(term));
  }, [bodyRegion]);

  const photoTypeLabel = (value) =>
    t(`consultations.photos.types.${value}`, PHOTO_TYPE_OPTIONS.find((o) => o.value === value)?.label || value);

  const beforePhotos = useMemo(
    () => photos.filter((p) => p.photoType === 'BEFORE'),
    [photos]
  );
  const afterPhotos = useMemo(
    () => photos.filter((p) => p.photoType === 'AFTER'),
    [photos]
  );

  const urlFor = (p) => {
    if (!p?.url) return null;
    if (p.url.startsWith('http')) return p.url;
    return `${APP_CONFIG.apiOrigin}${p.url}`;
  };

  const onUpload = async (e) => {
    e.preventDefault();
    if (!file || !captureUnlocked) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('photoType', photoType);
    fd.append('laterality', laterality);
    if (title) fd.append('title', title);
    if (bodyRegion) fd.append('bodyRegion', bodyRegion);
    fd.append('consentVerified', consentVerified ? 'true' : 'false');
    // Restricted-area capture is a HARD BLOCK enforced server-side
    // (ClinicalPhotoPolicyService#assertBodyRegionAllowed) — this call still fires and the
    // server refuses it with RESTRICTED_BODY_AREA; the client hint above is advisory only.
    await upload.mutateAsync(fd);
    setFile(null);
    setTitle('');
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t('consultations.photos.title', 'Clinical photos')}</h3>

      {!readOnly && (
        <form onSubmit={onUpload} className="space-y-3 rounded-lg border p-3">
          {/*
            Pre-capture gate: consent (and body region, where it applies) must be confirmed
            BEFORE the file picker / camera trigger unlock. Previously the checkbox sat next to
            an already-usable file input, so a photo could be picked (and, if the user forgot to
            tick the box, submitted) before consent was ever considered. Server-side enforcement
            is unchanged — this is purely about not presenting the capture control as available
            until the gate in front of it has actually been cleared.
          */}
          {!visitConfirmed && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              {t(
                'consultations.photos.noVisitHint',
                'No patient/visit context — capture is unavailable until a consultation is open.'
              )}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t('consultations.photos.laterality', 'Body side (laterality)')}</Label>
              <Select value={laterality} onChange={(e) => setLaterality(e.target.value)}>
                <option value="">{t('consultations.photos.selectLaterality', 'Select side…')}</option>
                {PHOTO_LATERALITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(`consultations.photos.lateralityOptions.${o.value}`, o.label)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('consultations.photos.purpose', 'Purpose')}</Label>
              <Select value={photoType} onChange={(e) => setPhotoType(e.target.value)}>
                {PHOTO_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {photoTypeLabel(o.value)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t('consultations.photos.bodyRegion', 'Body region')}</Label>
            <Input value={bodyRegion} onChange={(e) => setBodyRegion(e.target.value)} />
            {restrictedHint && (
              <p className="text-xs text-destructive">
                {t(
                  'consultations.photos.restrictedHint',
                  'This body area may be blocked by clinic policy — the server will refuse the upload unless a doctor-authorized exception applies.'
                )}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>{t('consultations.photos.titleField', 'Title')}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={consentVerified}
              onChange={(e) => {
                const checked = e.target.checked;
                setConsentVerified(checked);
                if (!checked) setFile(null);
              }}
            />
            {t('consultations.photos.consentVerified', 'Photography consent verified')}
          </label>

          {captureUnlocked ? (
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          ) : (
            <p className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
              {t(
                'consultations.photos.consentGateHint',
                'Confirm patient/visit, body side, purpose and photography consent above to unlock the file picker and camera.'
              )}
            </p>
          )}

          <Button type="submit" disabled={!captureUnlocked || !file || upload.isPending}>
            {t('common.upload', 'Upload')}
          </Button>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-lg border">
            {urlFor(p) && !p.metadata?.seeded ? (
              <img src={urlFor(p)} alt={p.title || p.photoType} className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-36 items-center justify-center bg-muted text-xs text-muted-foreground">
                {photoTypeLabel(p.photoType)} · {p.bodyRegion || '—'}
              </div>
            )}
            <div className="space-y-0.5 p-2 text-xs">
              <p className="font-medium">{p.title || p.originalName}</p>
              <p className="text-muted-foreground">
                {photoTypeLabel(p.photoType)}
                {p.consentVerified
                  ? ` · ${t('consultations.photos.consentOk', 'Consent ✓')}`
                  : ` · ${t('consultations.photos.consentPending', 'Consent pending')}`}
              </p>
              {/*
                IMG-005 — photos are hidden from the patient until a doctor releases them, and until
                now there was no control anywhere that could change that, so the portal's "not
                released" refusal was permanent. Shown regardless of `readOnly`: release is a
                post-signature decision, so a signed consultation must not lock it away.
              */}
              <p className="text-muted-foreground">
                {p.patientVisibility === 'HIDDEN'
                  ? t('consultations.photos.visibilityHidden', 'Hidden from patient')
                  : t('consultations.photos.visibilityReleased', 'Released to patient')}
              </p>
              <PermissionGuard permissions={[PERMISSIONS.CONSULTATION_ALL, PERMISSIONS.CLINICAL_SIGN]}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={release.isPending || (!p.consentVerified && p.patientVisibility === 'HIDDEN')}
                  onClick={() =>
                    release.mutate({
                      photoId: p.id,
                      visibility: p.patientVisibility === 'HIDDEN' ? 'RELEASED' : 'HIDDEN',
                    })
                  }
                >
                  {p.patientVisibility === 'HIDDEN'
                    ? t('consultations.photos.release', 'Release to patient')
                    : t('consultations.photos.unrelease', 'Hide from patient')}
                </Button>
              </PermissionGuard>
            </div>
          </div>
        ))}
        {!photos.length && (
          <p className="text-sm text-muted-foreground">{t('consultations.photos.noPhotos', 'No clinical photos yet.')}</p>
        )}
      </div>

      {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
        <div className="space-y-2 rounded-lg border p-3">
          <h4 className="text-sm font-semibold">{t('consultations.photos.comparison', 'Comparison view')}</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              value={compare.before}
              onChange={(e) => setCompare((p) => ({ ...p, before: e.target.value }))}
            >
              <option value="">{t('consultations.photos.beforePhoto', 'Before photo')}</option>
              {beforePhotos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || p.id}
                </option>
              ))}
            </Select>
            <Select
              value={compare.after}
              onChange={(e) => setCompare((p) => ({ ...p, after: e.target.value }))}
            >
              <option value="">{t('consultations.photos.afterPhoto', 'After photo')}</option>
              {afterPhotos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || p.id}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[compare.before, compare.after].map((id) => {
              const p = photos.find((x) => x.id === id);
              if (!p) {
                return (
                  <div
                    key={id || Math.random()}
                    className="flex h-40 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground"
                  >
                    {t('consultations.photos.selectPhoto', 'Select photo')}
                  </div>
                );
              }
              return urlFor(p) && !p.metadata?.seeded ? (
                <img
                  key={p.id}
                  src={urlFor(p)}
                  alt={p.title}
                  className="h-40 w-full rounded-md object-cover"
                />
              ) : (
                <div
                  key={p.id}
                  className="flex h-40 items-center justify-center rounded-md bg-muted text-xs"
                >
                  {t('consultations.photos.placeholder', '{{type}} placeholder', { type: photoTypeLabel(p.photoType) })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
