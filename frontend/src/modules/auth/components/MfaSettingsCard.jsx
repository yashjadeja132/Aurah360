import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { authApi } from '../api/authApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

/** SEC-002 — staff MFA enrollment (TOTP, any authenticator app). */
export function MfaSettingsCard() {
  const { user } = useAuth();
  const [setup, setSetup] = useState(null); // { secret, otpauthUri }
  const [confirmCode, setConfirmCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);

  const startMutation = useMutation({
    mutationFn: authApi.startMfaSetup,
    onSuccess: (res) => setSetup(res.data),
    onError: (err) => toast.error(err.response?.data?.message || 'Could not start MFA setup'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => authApi.confirmMfaSetup(confirmCode),
    onSuccess: (res) => {
      setBackupCodes(res.data.backupCodes);
      setSetup(null);
      toast.success('MFA enabled');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Invalid code'),
  });

  const disableMutation = useMutation({
    mutationFn: () => authApi.disableMfa(disableCode),
    onSuccess: () => {
      setDisableCode('');
      toast.success('MFA disabled');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Invalid code'),
  });

  if (backupCodes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-success" /> MFA enabled — save your backup codes
          </CardTitle>
          <CardDescription>
            Each code can be used once if you lose access to your authenticator app. Store them somewhere safe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-sm">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <Button className="mt-4" variant="outline" size="sm" onClick={() => setBackupCodes(null)}>
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Two-factor authentication</CardTitle>
        <CardDescription>Add an authenticator-app code to your sign-in.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {user?.mfaEnabled ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-success">
              <ShieldCheck className="h-4 w-4" /> MFA is currently enabled on your account.
            </p>
            <div className="space-y-2">
              <Label htmlFor="disableCode">Enter a code to disable MFA</Label>
              <div className="flex gap-2">
                <Input
                  id="disableCode"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="000000"
                  className="max-w-[10rem]"
                />
                <Button
                  variant="destructive"
                  disabled={disableMutation.isPending || disableCode.length < 6}
                  onClick={() => disableMutation.mutate()}
                >
                  <ShieldOff className="h-4 w-4" /> Disable
                </Button>
              </div>
            </div>
          </div>
        ) : setup ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Scan this into Google Authenticator / Authy, or enter the key manually:
            </p>
            <p className="break-all rounded-lg bg-muted p-3 font-mono text-xs">{setup.secret}</p>
            <div className="space-y-2">
              <Label htmlFor="confirmCode">Enter the 6-digit code to confirm</Label>
              <div className="flex gap-2">
                <Input
                  id="confirmCode"
                  maxLength={6}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="000000"
                  className="max-w-[10rem]"
                />
                <Button disabled={confirmMutation.isPending || confirmCode.length < 6} onClick={() => confirmMutation.mutate()}>
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
            <ShieldCheck className="h-4 w-4" /> Set up MFA
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default MfaSettingsCard;
