import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { consultationsApi } from '@/modules/consultations/api/consultationsApi';
import { billingApi } from '@/modules/billing/api/billingApi';
import { receptionApi } from '../api/receptionApi';

const PHOTO_TYPES = [
  { value: 'BEFORE', label: 'Before' },
  { value: 'BODY_MAP', label: 'Body map' },
  { value: 'OTHER', label: 'Other' },
];

const PAY_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'Online (UPI)' },
  { value: 'CARD', label: 'Card' },
];

/**
 * Step 2 of check-in / walk-in (simplified flow): attach intake photos (optional —
 * some patients decline, e.g. private areas), collect the consultation fee
 * (cash / online), then send the file to the doctor — which queues the AI precheck.
 */
export function IntakeStep({ intake, onDone }) {
  const { appointmentId, consultationId, patientId, branchId, tokenNumber, feeDefault } = intake;

  const [file, setFile] = useState(null);
  const [photoType, setPhotoType] = useState('BEFORE');
  const [bodyRegion, setBodyRegion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);

  const [amount, setAmount] = useState(feeDefault || 500);
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [paid, setPaid] = useState(null);

  const [sending, setSending] = useState(false);

  const uploadPhoto = async () => {
    if (!file || !consultationId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('photoType', photoType);
      if (bodyRegion) fd.append('bodyRegion', bodyRegion);
      fd.append('consentVerified', 'true');
      await consultationsApi.uploadPhoto(consultationId, fd);
      setPhotoCount((n) => n + 1);
      setFile(null);
      toast.success('Photo added to the file');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Photo upload failed');
    } finally {
      setUploading(false);
    }
  };

  const collectPayment = async () => {
    if (!patientId || !branchId || collecting || paid) return;
    if (method !== 'CASH' && !reference.trim()) {
      toast.error('Reference / transaction ID is required for online payment');
      return;
    }
    setCollecting(true);
    try {
      const created = await billingApi.create({
        patientId,
        branchId,
        consultationId: consultationId || undefined,
        appointmentId: appointmentId || undefined,
        items: [
          {
            itemType: 'CONSULTATION',
            referenceId: '',
            description: 'Consultation fee',
            quantity: 1,
            unitPrice: Number(amount) || 0,
            discount: 0,
          },
        ],
      });
      const invoiceId = created?.data?.invoice?.id;
      if (!invoiceId) throw new Error('Invoice was not created');
      await billingApi.finalize(invoiceId);
      const total = created?.data?.invoice?.total ?? Number(amount) ?? 0;
      await billingApi.recordPayment(invoiceId, {
        amount: total,
        method,
        reference: method === 'CASH' ? null : reference.trim(),
      });
      setPaid({ amount: total, method });
      toast.success(`Payment of Rs.${total} collected (${method})`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Payment failed');
    } finally {
      setCollecting(false);
    }
  };

  const sendToDoctor = async () => {
    setSending(true);
    try {
      await receptionApi.completeIntake(appointmentId);
      toast.success('File sent to the doctor — AI analysis is running');
      onDone?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not complete intake');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        {tokenNumber && <Badge variant="success">Token {tokenNumber}</Badge>}
        {photoCount > 0 && <Badge variant="info">{photoCount} photo{photoCount > 1 ? 's' : ''}</Badge>}
        {paid && <Badge variant="success">Paid Rs.{paid.amount} · {paid.method}</Badge>}
      </div>

      {/* Photos — optional */}
      <div className="space-y-2 rounded-lg border border-border p-3">
        <Label>Photos of the affected area (optional)</Label>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            type="file"
            accept="image/*"
            className="max-w-[180px]"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Select value={photoType} onChange={(e) => setPhotoType(e.target.value)} className="w-28">
            {PHOTO_TYPES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Input
            value={bodyRegion}
            onChange={(e) => setBodyRegion(e.target.value)}
            placeholder="Body area (e.g. forearm)"
            className="w-40"
          />
          <Button type="button" size="sm" onClick={uploadPhoto} disabled={!file || uploading || !consultationId}>
            {uploading ? 'Uploading…' : 'Add photo'}
          </Button>
        </div>
        {!consultationId && (
          <p className="text-xs text-muted-foreground">File could not be opened — photos can be added by the doctor instead.</p>
        )}
      </div>

      {/* Fee collection */}
      <div className="space-y-2 rounded-lg border border-border p-3">
        <Label>Consultation fee</Label>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28"
            disabled={Boolean(paid)}
          />
          <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-36" disabled={Boolean(paid)}>
            {PAY_METHODS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          {method !== 'CASH' && !paid && (
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Txn reference"
              className="w-36"
            />
          )}
          <Button type="button" size="sm" variant={paid ? 'success' : 'default'} onClick={collectPayment} disabled={collecting || Boolean(paid)}>
            {paid ? 'Collected ✓' : collecting ? 'Collecting…' : 'Collect'}
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={() => onDone?.()}>
          Skip for now
        </Button>
        <Button type="button" onClick={sendToDoctor} disabled={sending}>
          {sending ? 'Sending…' : 'Send file to doctor'}
        </Button>
      </div>
      {!paid && (
        <p className="text-right text-xs text-amber-700">Payment not collected yet.</p>
      )}
    </div>
  );
}
