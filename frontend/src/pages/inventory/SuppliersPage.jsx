import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSuppliers, useCreateSupplier } from '@/modules/inventory/hooks/useInventory';

export default function SuppliersPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useSuppliers({ limit: 50 });
  const create = useCreateSupplier();
  const suppliers = data?.items || [];
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('inventory.suppliers.title', 'Suppliers')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('inventory.suppliers.subtitle', 'GST, contact, address, payment terms.')}
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Input placeholder={t('inventory.suppliers.name', 'Name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder={t('inventory.suppliers.gstin', 'GSTIN')} value={gstin} onChange={(e) => setGstin(e.target.value)} />
        <Input placeholder={t('inventory.suppliers.phone', 'Phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input
          placeholder={t('inventory.suppliers.paymentTerms', 'Payment terms')}
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
        />
        <Button
          disabled={!name || create.isPending}
          onClick={() =>
            create.mutate(
              { name, gstin, phone, paymentTerms, contactName: 'Sales' },
              {
                onSuccess: () => {
                  setName('');
                  setGstin('');
                },
              }
            )
          }
        >
          {t('inventory.suppliers.addSupplier', 'Add supplier')}
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">{t('inventory.suppliers.loading', 'Loading…')}</p>}
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-xl border p-3">
            <p className="font-medium">
              {s.name}{' '}
              <span className="text-xs text-muted-foreground">{s.supplierCode}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t('inventory.suppliers.gst', 'GST')} {s.gstin || '—'} · {s.phone || '—'} · {s.paymentTerms} ·{' '}
              {s.address?.city || '—'}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
