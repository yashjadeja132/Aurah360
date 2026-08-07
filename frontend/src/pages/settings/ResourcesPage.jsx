import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DoorOpen, Cpu, BadgeCheck, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useStaffList } from '@/modules/users/hooks/useStaff';
import {
  useRooms, useCreateRoom, useUpdateRoomStatus,
  useDevices, useCreateDevice, useUpdateDeviceStatus,
  useSkills, useGrantSkill, useRevokeSkill,
} from '@/modules/resources/hooks/useResources';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';

const STATUS_VARIANT = { AVAILABLE: 'success', IN_USE: 'info', MAINTENANCE: 'warning', BLOCKED: 'destructive' };

/** ORG-003/TRT-003 — room/device inventory and staff skill/credential register. */
export default function ResourcesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('rooms');
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];
  const [branchId, setBranchId] = useState('');

  const TABS = [
    { id: 'rooms', label: t('settings.resources.tabs.rooms', 'Rooms'), icon: DoorOpen },
    { id: 'devices', label: t('settings.resources.tabs.devices', 'Devices'), icon: Cpu },
    { id: 'skills', label: t('settings.resources.tabs.skills', 'Staff skills'), icon: BadgeCheck },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('settings.resources.title', 'Resources')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.resources.description', 'Rooms, devices and staff skills/credentials.')}</p>
      </div>

      <div className="flex gap-2 border-b">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium',
              tab === tb.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tb.icon className="h-4 w-4" /> {tb.label}
          </button>
        ))}
        <div className="ml-auto py-1">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-48">
            <option value="">{t('settings.resources.allBranches', 'All branches')}</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.displayName || b.name}</option>)}
          </Select>
        </div>
      </div>

      {tab === 'rooms' && <RoomsTab branches={branches} branchId={branchId} />}
      {tab === 'devices' && <DevicesTab branches={branches} branchId={branchId} />}
      {tab === 'skills' && <SkillsTab branches={branches} branchId={branchId} />}
    </section>
  );
}

function RoomsTab({ branches, branchId }) {
  const { t } = useTranslation();
  const { data: rooms = [], isLoading } = useRooms(branchId ? { branchId } : {});
  const create = useCreateRoom();
  const updateStatus = useUpdateRoomStatus();
  const [form, setForm] = useState({ branchId: '', name: '', code: '', capacity: '1' });

  return (
    <div className="space-y-4">
      <PermissionGuard permissions={[PERMISSIONS.RESOURCES_MANAGE, PERMISSIONS.RESOURCES_ALL]}>
        <Card>
          <CardHeader><CardTitle>{t('settings.resources.rooms.newCard', 'New room')}</CardTitle></CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!form.branchId || !form.name || !form.code) return;
                await create.mutateAsync({ ...form, capacity: Number(form.capacity) || 1 });
                setForm({ branchId: form.branchId, name: '', code: '', capacity: '1' });
              }}
            >
              <Select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
                <option value="">{t('settings.resources.rooms.branchPlaceholder', 'Branch')}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.displayName || b.name}</option>)}
              </Select>
              <Input placeholder={t('settings.resources.rooms.namePlaceholder', 'Name')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <Input placeholder={t('settings.resources.rooms.codePlaceholder', 'Code')} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              <Button type="submit" disabled={create.isPending}><Plus className="h-4 w-4" /> {t('settings.resources.rooms.addAction', 'Add room')}</Button>
            </form>
          </CardContent>
        </Card>
      </PermissionGuard>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow><TableHead>{t('settings.resources.rooms.table.name', 'Name')}</TableHead><TableHead>{t('settings.resources.rooms.table.code', 'Code')}</TableHead><TableHead>{t('settings.resources.rooms.table.type', 'Type')}</TableHead><TableHead>{t('settings.resources.rooms.table.status', 'Status')}</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && rooms.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t('settings.resources.rooms.empty', 'No rooms yet.')}</TableCell></TableRow>}
              {rooms.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.code}</TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[r.status] || 'secondary'}>{r.status}</Badge></TableCell>
                  <TableCell>
                    <PermissionGuard permissions={[PERMISSIONS.RESOURCES_MANAGE, PERMISSIONS.RESOURCES_ALL]}>
                      <Select
                        className="w-40"
                        value={r.status}
                        onChange={(e) => updateStatus.mutate({ id: r.id, payload: { status: e.target.value } })}
                      >
                        {['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'BLOCKED'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </Select>
                    </PermissionGuard>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DevicesTab({ branches, branchId }) {
  const { t } = useTranslation();
  const { data: devices = [], isLoading } = useDevices(branchId ? { branchId } : {});
  const create = useCreateDevice();
  const updateStatus = useUpdateDeviceStatus();
  const [form, setForm] = useState({ branchId: '', name: '', code: '' });

  return (
    <div className="space-y-4">
      <PermissionGuard permissions={[PERMISSIONS.RESOURCES_MANAGE, PERMISSIONS.RESOURCES_ALL]}>
        <Card>
          <CardHeader><CardTitle>{t('settings.resources.devices.newCard', 'New device')}</CardTitle></CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!form.branchId || !form.name || !form.code) return;
                await create.mutateAsync(form);
                setForm({ branchId: form.branchId, name: '', code: '' });
              }}
            >
              <Select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
                <option value="">{t('settings.resources.devices.branchPlaceholder', 'Branch')}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.displayName || b.name}</option>)}
              </Select>
              <Input placeholder={t('settings.resources.devices.namePlaceholder', 'Name')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <Input placeholder={t('settings.resources.devices.codePlaceholder', 'Code')} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              <Button type="submit" disabled={create.isPending}><Plus className="h-4 w-4" /> {t('settings.resources.devices.addAction', 'Add device')}</Button>
            </form>
          </CardContent>
        </Card>
      </PermissionGuard>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow><TableHead>{t('settings.resources.devices.table.name', 'Name')}</TableHead><TableHead>{t('settings.resources.devices.table.code', 'Code')}</TableHead><TableHead>{t('settings.resources.devices.table.capability', 'Capability')}</TableHead><TableHead>{t('settings.resources.devices.table.status', 'Status')}</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && devices.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t('settings.resources.devices.empty', 'No devices yet.')}</TableCell></TableRow>}
              {devices.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.code}</TableCell>
                  <TableCell>{d.capability}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[d.status] || 'secondary'}>{d.status}</Badge></TableCell>
                  <TableCell>
                    <PermissionGuard permissions={[PERMISSIONS.RESOURCES_MANAGE, PERMISSIONS.RESOURCES_ALL]}>
                      <Select
                        className="w-40"
                        value={d.status}
                        onChange={(e) => updateStatus.mutate({ id: d.id, payload: { status: e.target.value } })}
                      >
                        {['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'BLOCKED'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </Select>
                    </PermissionGuard>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SkillsTab({ branches, branchId }) {
  const { t } = useTranslation();
  const { data: skills = [], isLoading } = useSkills(branchId ? { branchId } : {});
  const { data: staffData } = useStaffList({ limit: 100 });
  const staff = staffData?.items || [];
  const grant = useGrantSkill();
  const revoke = useRevokeSkill();
  const [form, setForm] = useState({ userId: '', skillCode: '', name: '' });

  return (
    <div className="space-y-4">
      <PermissionGuard permissions={[PERMISSIONS.RESOURCES_MANAGE, PERMISSIONS.RESOURCES_ALL]}>
        <Card>
          <CardHeader><CardTitle>{t('settings.resources.skills.grantCard', 'Grant a skill/credential')}</CardTitle></CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!form.userId || !form.skillCode || !form.name) return;
                await grant.mutateAsync(form);
                setForm({ userId: '', skillCode: '', name: '' });
              }}
            >
              <Select value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}>
                <option value="">{t('settings.resources.skills.staffPlaceholder', 'Staff member')}</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
              </Select>
              <Input placeholder={t('settings.resources.skills.skillCodePlaceholder', 'Skill code (e.g. LASER_L2)')} value={form.skillCode} onChange={(e) => setForm((f) => ({ ...f, skillCode: e.target.value }))} />
              <Input placeholder={t('settings.resources.skills.displayNamePlaceholder', 'Display name')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <Button type="submit" disabled={grant.isPending}><Plus className="h-4 w-4" /> {t('settings.resources.skills.grantAction', 'Grant')}</Button>
            </form>
          </CardContent>
        </Card>
      </PermissionGuard>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow><TableHead>{t('settings.resources.skills.table.staff', 'Staff')}</TableHead><TableHead>{t('settings.resources.skills.table.skill', 'Skill')}</TableHead><TableHead>{t('settings.resources.skills.table.status', 'Status')}</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && skills.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t('settings.resources.skills.empty', 'No skills recorded yet.')}</TableCell></TableRow>}
              {skills.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.userName || s.userId}</TableCell>
                  <TableCell>{s.name} <span className="text-xs text-muted-foreground">({s.skillCode})</span></TableCell>
                  <TableCell><Badge variant={s.status === 'ACTIVE' ? 'success' : 'secondary'}>{s.status}</Badge></TableCell>
                  <TableCell>
                    {s.status === 'ACTIVE' && (
                      <PermissionGuard permissions={[PERMISSIONS.RESOURCES_MANAGE, PERMISSIONS.RESOURCES_ALL]}>
                        <Button size="sm" variant="outline" onClick={() => revoke.mutate(s.id)}>{t('settings.resources.skills.revokeAction', 'Revoke')}</Button>
                      </PermissionGuard>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
