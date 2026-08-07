import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { prescriptionsApi } from '../api/prescriptionsApi';

/**
 * Medicine autocomplete — searches master catalog.
 */
export function MedicineSearchInput({ onSelect, placeholder }) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('prescriptions.medicineSearch.placeholder', 'Search medicine…');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return undefined;
    }
    const t = setTimeout(() => {
      prescriptionsApi
        .searchMedicines(q, 12)
        .then((res) => setResults(res.data || []))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

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
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-card shadow-lg">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onSelect?.(m);
                  setQ('');
                  setResults([]);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{m.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {m.strength} · {m.genericName || m.brand}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
