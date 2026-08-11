import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useClinicId, setClinicId } from '@/stores/clinicStore';
import { ColorDot } from '@/components/common/ColorDot';
import { cn } from '@/utils/cn';

/**
 * Header clinic dropdown (Owner/Admin): "All clinics" is the default on every app open;
 * each clinic carries its color code so its data is recognizable everywhere.
 */
export function ClinicSwitcher() {
  const clinicId = useClinicId();
  const { data } = useBranchList({ limit: 50 });
  const branches = data?.branches || data?.items || (Array.isArray(data) ? data : []);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const current = branches.find((b) => (b.id || b._id) === clinicId);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm hover:bg-muted"
      >
        {current ? (
          <ColorDot id={current.id || current._id} />
        ) : (
          <Building2 className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="max-w-[140px] truncate">{current ? current.name : 'All clinics'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-border bg-background p-1 shadow-elev-md">
          <button
            type="button"
            onClick={() => {
              setClinicId('');
              setOpen(false);
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted',
              !clinicId && 'font-semibold'
            )}
          >
            <Building2 className="h-4 w-4 text-muted-foreground" />
            All clinics
            {!clinicId && <Check className="ml-auto h-3.5 w-3.5" />}
          </button>
          {branches.map((b) => {
            const id = b.id || b._id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setClinicId(id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted',
                  clinicId === id && 'font-semibold'
                )}
              >
                <ColorDot id={id} />
                <span className="truncate">{b.name}</span>
                {clinicId === id && <Check className="ml-auto h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
