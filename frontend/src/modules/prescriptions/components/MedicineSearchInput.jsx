import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { prescriptionsApi } from '../api/prescriptionsApi';
import { QuickAddMedicineDialog } from './QuickAddMedicineDialog';

/**
 * Medicine autocomplete — searches master catalog. If the search comes back empty, "Add new
 * medicine" opens QuickAddMedicineDialog inline (see its docblock) so the doctor never has to
 * abandon the prescription they're mid-way through writing just because a drug isn't in the
 * catalog yet.
 */
export function MedicineSearchInput({ onSelect, placeholder }) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('prescriptions.medicineSearch.placeholder', 'Search medicine…');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  // True from the moment a non-empty query exists until its debounced request actually
  // resolves — covers both the 250ms debounce window and the network round-trip, so the
  // dropdown shows "Searching…" instead of reading as "no results" while a request is in
  // flight for what's currently typed.
  const [searching, setSearching] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const t = setTimeout(() => {
      prescriptionsApi
        .searchMedicines(q, 12)
        .then((res) => {
          setResults(res.data || []);
          setSearched(true);
        })
        .catch(() => {
          setResults([]);
          setSearched(true);
        })
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const selectMedicine = (m) => {
    onSelect?.(m);
    setQ('');
    setResults([]);
    setSearched(false);
    setSearching(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        value={q}
        placeholder={resolvedPlaceholder}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (results.length > 0 || searching || (searched && q.trim())) && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-card shadow-lg">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => selectMedicine(m)}
              >
                <span className="font-medium">{m.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {m.strength} · {m.genericName || m.brand}
                </span>
              </button>
            </li>
          ))}
          {searching && !results.length && (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {t('common.searching', 'Searching…')}
            </li>
          )}
          {searched && !searching && (
            <li className="border-t">
              <button
                type="button"
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-muted"
                onClick={() => setQuickAddOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                {results.length
                  ? t('prescriptions.medicineSearch.notListedAddNew', "Not listed — add \"{{name}}\" as a new medicine", { name: q })
                  : t('prescriptions.medicineSearch.noMatchAddNew', "No match — add \"{{name}}\" as a new medicine", { name: q })}
              </button>
            </li>
          )}
        </ul>
      )}
      <QuickAddMedicineDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onCreated={selectMedicine}
        defaultName={q}
      />
    </div>
  );
}
