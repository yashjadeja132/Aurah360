import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';
import {
  useHandoffNotesForPatient,
  useCreateHandoffNote,
  useAcknowledgeHandoffNote,
  useAmendHandoffNote,
} from '../hooks/useHandoff';

const CATEGORIES = [
  { value: 'EXPECTATION', label: 'Expectation' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'URGENCY', label: 'Urgency' },
  { value: 'PREVIOUS_EXPERIENCE', label: 'Previous experience' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'ACCESSIBILITY', label: 'Accessibility' },
  { value: 'COMPANION', label: 'Companion' },
  { value: 'OTHER', label: 'Other' },
];

const URGENCIES = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'DOCTOR_ATTENTION', label: 'Doctor attention' },
  { value: 'IMMEDIATE_TRIAGE_ALERT', label: 'Immediate triage alert' },
];

const URGENCY_VARIANT = {
  NORMAL: 'secondary',
  DOCTOR_ATTENTION: 'warning',
  IMMEDIATE_TRIAGE_ALERT: 'destructive',
};

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
const URGENCY_LABEL = Object.fromEntries(URGENCIES.map((u) => [u.value, u.label]));

const CREATE_PERMISSIONS = [PERMISSIONS.HANDOFF_CREATE, PERMISSIONS.HANDOFF_ALL];
const ACK_PERMISSIONS = [PERMISSIONS.HANDOFF_ACKNOWLEDGE, PERMISSIONS.HANDOFF_ALL];

/** Reception → doctor structured handoff note panel (§5.3, PAT-006). */
export function HandoffNotePanel({ patientId, branchId }) {
  const { data: notes = [], isLoading } = useHandoffNotesForPatient(patientId);
  const createNote = useCreateHandoffNote();
  const acknowledgeNote = useAcknowledgeHandoffNote();
  const amendNote = useAmendHandoffNote();

  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [urgency, setUrgency] = useState(URGENCIES[0].value);
  const [note, setNote] = useState('');
  const [amendingId, setAmendingId] = useState(null);
  const [amendText, setAmendText] = useState('');
  const [amendReason, setAmendReason] = useState('');

  const onCreate = async (e) => {
    e.preventDefault();
    if (!note.trim()) {
      toast.error('Enter a note');
      return;
    }
    if (!branchId) {
      toast.error('Patient has no branch assigned — cannot create handoff note');
      return;
    }
    try {
      await createNote.mutateAsync({
        patientId,
        branchId,
        category,
        urgency,
        note: note.trim(),
      });
      setNote('');
      setCategory(CATEGORIES[0].value);
      setUrgency(URGENCIES[0].value);
    } catch {
      // toast handled in hook
    }
  };

  const onAcknowledge = async (id) => {
    try {
      await acknowledgeNote.mutateAsync({ id, payload: {} });
    } catch {
      // toast handled in hook
    }
  };

  const onAmendSubmit = async (id) => {
    if (!amendText.trim() || !amendReason.trim()) {
      toast.error('Amendment text and reason are both required');
      return;
    }
    try {
      await amendNote.mutateAsync({
        id,
        payload: { text: amendText.trim(), reason: amendReason.trim() },
      });
      setAmendingId(null);
      setAmendText('');
      setAmendReason('');
    } catch {
      // toast handled in hook
    }
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-6">
      <PermissionGuard permissions={CREATE_PERMISSIONS}>
        <Card>
          <CardHeader><CardTitle>New handoff note</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-4">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
              <Select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                {URGENCIES.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </Select>
              <textarea
                className="flex min-h-[2.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                placeholder="Note for the doctor…"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button type="submit" disabled={createNote.isPending} className="sm:col-span-4 sm:w-fit">
                Add handoff note
              </Button>
            </form>
          </CardContent>
        </Card>
      </PermissionGuard>

      {!notes.length ? (
        <EmptyState
          title="No handoff notes"
          description="Reception notes for the doctor will appear here once created."
        />
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => {
            const acknowledged = Boolean(n.acknowledgedAt);
            return (
              <li key={n.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{CATEGORY_LABEL[n.category] || n.category}</Badge>
                    <Badge variant={URGENCY_VARIANT[n.urgency] || 'secondary'}>
                      {URGENCY_LABEL[n.urgency] || n.urgency}
                    </Badge>
                    {acknowledged ? (
                      <Badge variant="success">Acknowledged</Badge>
                    ) : (
                      <Badge variant="warning">Pending acknowledgement</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                  </span>
                </div>

                <p className="mt-2 text-sm">{n.note}</p>

                {n.amendments?.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-border/60 pt-2">
                    {n.amendments.map((a, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Amendment:</span> {a.text}
                        {a.reason && <span> — reason: {a.reason}</span>}
                        {a.amendedAt && <span> · {new Date(a.amendedAt).toLocaleString()}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {acknowledged && n.resolutionNote && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Resolution:</span> {n.resolutionNote}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <PermissionGuard permissions={ACK_PERMISSIONS}>
                    {!acknowledged && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acknowledgeNote.isPending}
                        onClick={() => onAcknowledge(n.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </PermissionGuard>
                  <PermissionGuard permissions={CREATE_PERMISSIONS}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAmendingId(amendingId === n.id ? null : n.id);
                        setAmendText('');
                        setAmendReason('');
                      }}
                    >
                      Amend
                    </Button>
                  </PermissionGuard>
                </div>

                {amendingId === n.id && (
                  <div className={cn('mt-3 space-y-2 rounded-md border border-dashed border-border p-3')}>
                    <textarea
                      className="flex min-h-[2.25rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Amendment text…"
                      rows={2}
                      value={amendText}
                      onChange={(e) => setAmendText(e.target.value)}
                    />
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Reason for amendment…"
                      value={amendReason}
                      onChange={(e) => setAmendReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={amendNote.isPending} onClick={() => onAmendSubmit(n.id)}>
                        Save amendment
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAmendingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default HandoffNotePanel;
