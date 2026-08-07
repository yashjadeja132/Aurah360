import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { SUPPORTED_LANGUAGES, setLanguage } from '@/i18n/index.js';
import { cn } from '@/utils/cn';

/** NFR-014 — language picker; choice persists to localStorage and applies immediately. */
export function LanguageSwitcher({ className }) {
  const { i18n } = useTranslation();

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Languages className="h-4 w-4 text-muted-foreground" />
      <select
        aria-label="Language"
        value={i18n.language}
        onChange={(e) => setLanguage(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default LanguageSwitcher;
