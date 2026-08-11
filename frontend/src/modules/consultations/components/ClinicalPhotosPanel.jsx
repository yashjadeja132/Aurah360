import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { APP_CONFIG } from '@/constants/config';
import { BODY_REGIONS } from '@/constants/bodyRegions';
import { PHOTO_TYPE_OPTIONS } from '../constants';
import { consultationsApi } from '../api/consultationsApi';
import { useUploadPhoto } from '../hooks/useConsultations';

/**
 * Clinical photos, grouped by visit. The current visit's uploader is on top; below it,
 * every past visit's photos (including the intake photos reception attached) are grouped
 * by consultation so the doctor sees the whole timeline in one place.
 */
export function ClinicalPhotosPanel({ consultationId, readOnly }) {
  const { t } = useTranslation();
  const upload = useUploadPhoto(consultationId);
  const [photoType, setPhotoType] = useState('BEFORE');
  const [bodyRegion, setBodyRegion] = useState('');
  const [consentVerified, setConsentVerified] = useState(true);
  const [files, setFiles] = useState([]);

  const { data } = useQuery({
    queryKey: ['consultations', 'patient-photos', consultationId],
    queryFn: async () => (await consultationsApi.patientPhotos(consultationId)).data,
    enabled: Boolean(consultationId),
  });
  const groups = data?.groups || [];

  const photoTypeLabel = (v) =>
    PHOTO_TYPE_OPTIONS.find((o) => o.value === v)?.label || v;
  const urlFor = (p) => (!p?.url ? null : p.url.startsWith('http') ? p.url : `${APP_CONFIG.apiOrigin}${p.url}`);

  const onUpload = async (e) => {
    e.preventDefault();
    if (!files.length) return;
    for (const f of files) {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('photoType', photoType);
      if (bodyRegion) fd.append('bodyRegion', bodyRegion);
      fd.append('consentVerified', consentVerified ? 'true' : 'false');
      // eslint-disable-next-line no-await-in-loop
      await upload.mutateAsync(fd);
    }
    setFiles([]);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t('consultations.photos.title', 'Clinical photos')}</h3>

      {!readOnly && (
        <form onSubmit={onUpload} className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('consultations.photos.type', 'Type')}</Label>
              <Select value={photoType} onChange={(e) => setPhotoType(e.target.value)} className="w-28">
                {PHOTO_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{photoTypeLabel(o.value)}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('consultations.photos.bodyRegion', 'Body area')}</Label>
              <Select
                value={BODY_REGIONS.includes(bodyRegion) || !bodyRegion ? bodyRegion : '__other__'}
                onChange={(e) => setBodyRegion(e.target.value === '__other__' ? ' ' : e.target.value)}
                className="w-40"
              >
                <option value="">Body area…</option>
                {BODY_REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value="__other__">Other (type)…</option>
              </Select>
            </div>
            {bodyRegion && !BODY_REGIONS.includes(bodyRegion) && (
              <Input
                autoFocus
                value={bodyRegion.trim() === '' ? '' : bodyRegion}
                onChange={(e) => setBodyRegion(e.target.value)}
                placeholder="Type body area"
                className="w-40"
              />
            )}
          </div>
          <Input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={consentVerified} onChange={(e) => setConsentVerified(e.target.checked)} />
            {t('consultations.photos.consentVerified', 'Photography consent verified')}
          </label>
          <Button type="submit" size="sm" disabled={!files.length || upload.isPending}>
            {upload.isPending ? t('common.uploading', 'Uploading…') : files.length > 1 ? `Upload ${files.length} photos` : t('common.upload', 'Upload')}
          </Button>
        </form>
      )}

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('consultations.photos.noPhotos', 'No clinical photos yet.')}</p>
      )}

      {groups.map((g) => (
        <div key={g.consultationId} className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            {g.isCurrent ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">This visit</span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {g.date ? new Date(g.date).toLocaleDateString() : g.consultationNumber}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{g.photos.length} photo{g.photos.length > 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {g.photos.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-lg border">
                {urlFor(p) && !p.metadata?.seeded ? (
                  <img src={urlFor(p)} alt={p.bodyRegion || p.photoType} className="h-24 w-full object-cover" />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-muted text-[10px] text-muted-foreground">
                    {photoTypeLabel(p.photoType)}
                  </div>
                )}
                <p className="truncate px-1 py-0.5 text-[10px] text-muted-foreground">
                  {photoTypeLabel(p.photoType)}{p.bodyRegion ? ` · ${p.bodyRegion}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
