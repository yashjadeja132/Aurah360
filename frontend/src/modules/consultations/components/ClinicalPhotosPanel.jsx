import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { APP_CONFIG } from '@/constants/config';
import { PHOTO_TYPE_OPTIONS } from '../constants';
import { useReleasePhoto, useUploadPhoto } from '../hooks/useConsultations';

export function ClinicalPhotosPanel({ consultationId, photos = [], readOnly }) {
  const { t } = useTranslation();
  const upload = useUploadPhoto(consultationId);
  const release = useReleasePhoto(consultationId);
  const [photoType, setPhotoType] = useState('BEFORE');
  const [title, setTitle] = useState('');
  const [bodyRegion, setBodyRegion] = useState('');
  const [consentVerified, setConsentVerified] = useState(false);
  const [file, setFile] = useState(null);
  const [compare, setCompare] = useState({ before: '', after: '' });

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
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('photoType', photoType);
    if (title) fd.append('title', title);
    if (bodyRegion) fd.append('bodyRegion', bodyRegion);
    fd.append('consentVerified', consentVerified ? 'true' : 'false');
    await upload.mutateAsync(fd);
    setFile(null);
    setTitle('');
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t('consultations.photos.title', 'Clinical photos')}</h3>

      {!readOnly && (
        <form onSubmit={onUpload} className="space-y-3 rounded-lg border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t('consultations.photos.type', 'Type')}</Label>
              <Select value={photoType} onChange={(e) => setPhotoType(e.target.value)}>
                {PHOTO_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {photoTypeLabel(o.value)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('consultations.photos.bodyRegion', 'Body region')}</Label>
              <Input value={bodyRegion} onChange={(e) => setBodyRegion(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t('consultations.photos.titleField', 'Title')}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={consentVerified}
              onChange={(e) => setConsentVerified(e.target.checked)}
            />
            {t('consultations.photos.consentVerified', 'Photography consent verified')}
          </label>
          <Button type="submit" disabled={!file || upload.isPending}>
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
