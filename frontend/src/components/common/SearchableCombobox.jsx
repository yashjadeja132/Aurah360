import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils/cn';

/**
 * One search box that IS the selector — type to filter, click a row to pick, no separate
 * native `<select>` sitting below a search input the way the booking pickers (Branch, Doctor,
 * Service, Patient) used to work. That older two-control layout made "search" and "select" feel
 * like unrelated steps; this merges them into the same interaction the medicine-search box in
 * prescribing already used successfully. Reused across every dynamic-list selection field that
 * needs search, not just patients — see PatientPicker/DoctorPicker/BranchPicker/ServicePicker in
 * bookingPickers.jsx for the concrete usages.
 *
 * Two modes, chosen by whether `onSearchChange` is passed:
 *   - Server-search mode (patients): the caller owns the search text and re-fetches `options`
 *     as it changes (e.g. via a paginated API search) — this component only renders whatever
 *     `options` it's given and never filters them itself.
 *   - Client-filter mode (branch/doctor/service — small, already-fetched lists): omit
 *     `onSearchChange` and this component filters `options` locally by `filterKeys` as the user
 *     types, so no extra network round-trip is needed for lists that are already in memory.
 */
export function SearchableCombobox({
  value,
  onChange,
  options,
  getId = (o) => o.id,
  renderLabel,
  renderSublabel,
  placeholder,
  emptyText,
  loadingText,
  search: controlledSearch,
  onSearchChange,
  // True while a server-search request for the current text is in flight — shows a loading row
  // instead of `emptyText`. Without this, a debounced search reads as "no results" for the
  // ~250ms+ round-trip before the real results (or a genuine empty result) arrive, which is
  // actively misleading, not just a cosmetic flicker.
  isLoading = false,
  filterKeys = ['name'],
  onAddNew,
  addNewLabel,
  disabled = false,
}) {
  const isServerSearch = typeof onSearchChange === 'function';
  const [localSearch, setLocalSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const search = isServerSearch ? controlledSearch ?? '' : localSearch;
  const setSearch = isServerSearch ? onSearchChange : setLocalSearch;

  const selected = useMemo(() => (options || []).find((o) => getId(o) === value), [options, value, getId]);

  const filtered = useMemo(() => {
    if (isServerSearch) return options || [];
    const q = search.trim().toLowerCase();
    if (!q) return options || [];
    return (options || []).filter((o) =>
      filterKeys.some((key) => String(o[key] || '').toLowerCase().includes(q))
    );
  }, [options, search, isServerSearch, filterKeys]);

  // Close the dropdown on an outside click — standard combobox behaviour.
  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const select = (option) => {
    onChange(getId(option));
    setSearch('');
    setOpen(false);
  };

  const displayValue = open ? search : selected ? renderLabel(selected) : search;

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (selected) onChange('');
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-card shadow-lg">
          {filtered.map((option) => (
            <li key={getId(option)}>
              <button
                type="button"
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-muted',
                  getId(option) === value && 'bg-muted'
                )}
                onClick={() => select(option)}
              >
                <span className="font-medium">{renderLabel(option)}</span>
                {renderSublabel && (
                  <span className="ml-2 text-xs text-muted-foreground">{renderSublabel(option)}</span>
                )}
              </button>
            </li>
          ))}
          {!filtered.length && isLoading && (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {loadingText}
            </li>
          )}
          {!filtered.length && !isLoading && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {emptyText}
            </li>
          )}
          {onAddNew && !isLoading && (
            <li className="border-t">
              <button
                type="button"
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  onAddNew(search);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                {addNewLabel}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default SearchableCombobox;
