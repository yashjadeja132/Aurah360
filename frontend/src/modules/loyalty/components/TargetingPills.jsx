import { useTranslation } from 'react-i18next';

/**
 * Shared "all X, or pick specific ones" multi-select used by loyalty rule versions and
 * campaigns for branch/service/package targeting. Backend convention for these fields is
 * `[] = all` (see LoyaltyEarningRule.model.js ruleVersionSchema.branchIds/serviceIds/packageIds
 * and LoyaltyCampaign.model.js branchIds/serviceIds), so an empty selection here means "all"
 * rather than "none" — the pill list starts collapsed to that default.
 *
 * Mirrors the tag-toggle pill pattern already used in PatientForm.jsx (pill buttons, not a
 * separate search box + native <select>), scaled down to a checkbox-style toggle group since
 * these lists (branches, services, packages) are short.
 */
export function TargetingPills({
  label,
  options,
  value = [],
  onChange,
  getId = (o) => o.id,
  getLabel = (o) => o.name,
  allLabel,
  isLoading,
}) {
  const { t } = useTranslation();
  const toggle = (id) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">{t('common.loading', 'Loading…')}</p>
      ) : !options?.length ? (
        <p className="text-xs text-muted-foreground">{allLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {value.length === 0 && (
            <span className="rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground">
              {allLabel}
            </span>
          )}
          {options.map((opt) => {
            const id = getId(opt);
            const selected = value.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {getLabel(opt)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TargetingPills;
