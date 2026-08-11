import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { inventoryApi, pharmacyApi } from '../api/inventoryApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

function invalidateInv(qc) {
  qc.invalidateQueries({ queryKey: ['inventory'] });
  qc.invalidateQueries({ queryKey: ['pharmacy'] });
}

export function useInventoryDashboard() {
  return useQuery({
    queryKey: QUERY_KEYS.INVENTORY_DASHBOARD(),
    queryFn: async () => (await inventoryApi.dashboard()).data,
  });
}

export function useInventoryItems(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.INVENTORY_ITEMS(params),
    queryFn: async () => {
      const res = await inventoryApi.listItems(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useStockLedger(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.INVENTORY_LEDGER(params),
    queryFn: async () => {
      const res = await inventoryApi.ledger(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

/**
 * Batch expiry report. `GET /inventory/reports/:type` supports
 * `expiry` (expired + near-expiry) and `near-expiry` (near only); the service
 * returns one row per batch with { name, itemCode, batchNumber, expiryDate,
 * quantity, status: 'EXPIRED' | 'NEAR_EXPIRY' }. Key is inlined rather than
 * added to QUERY_KEYS so the shared constants file stays untouched — the
 * ['inventory', ...] prefix still matches the module-wide invalidator.
 */
export function useInventoryExpiryReport(params = {}) {
  return useQuery({
    queryKey: ['inventory', 'reports', 'expiry', params],
    queryFn: async () => {
      const res = await inventoryApi.report('expiry', params);
      return res.data?.items || [];
    },
  });
}

export function useSuppliers(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.INVENTORY_SUPPLIERS(params),
    queryFn: async () => {
      const res = await inventoryApi.listSuppliers(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function usePurchaseOrders(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.INVENTORY_POS(params),
    queryFn: async () => {
      const res = await inventoryApi.listPos(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

/**
 * INV-003 — `POST /inventory/adjust` now has two possible response shapes: a routine
 * (below-threshold) adjustment still returns the completed `{ item, transaction }` payload
 * exactly as before, but an "unusual" one returns `{ pendingApproval: true, request }` instead,
 * with stock untouched until someone with INVENTORY_ADJUST_APPROVE decides it.
 */
export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => inventoryApi.adjust(payload),
    onSuccess: (res) => {
      if (res?.data?.pendingApproval) {
        toast.info('Submitted for approval — unusual adjustment needs sign-off before it applies');
      } else {
        toast.success('Stock adjusted');
      }
      invalidateInv(qc);
      qc.invalidateQueries({ queryKey: ['inventory', 'adjustments'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Adjust failed')),
  });
}

// --- Stock adjustment approval queue (INV-003) ---
export function useAdjustmentRequests(params = {}) {
  return useQuery({
    queryKey: ['inventory', 'adjustments', params],
    queryFn: async () => (await inventoryApi.listAdjustmentRequests(params)).data.requests || [],
  });
}

export function useApproveAdjustmentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => inventoryApi.approveAdjustmentRequest(id),
    onSuccess: () => {
      toast.success('Adjustment approved');
      invalidateInv(qc);
      qc.invalidateQueries({ queryKey: ['inventory', 'adjustments'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not approve')),
  });
}

export function useRejectAdjustmentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => inventoryApi.rejectAdjustmentRequest(id, reason),
    onSuccess: () => {
      toast.success('Adjustment rejected');
      qc.invalidateQueries({ queryKey: ['inventory', 'adjustments'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not reject')),
  });
}

/**
 * PHARM-DIRECT toggle for `requiresPrescription` on an InventoryItem, exposed on the Direct
 * sale product list. NOTE: `backend/src/validators/inventory.validator.js` (`updateItemSchema`)
 * does not currently allow `requiresPrescription` in the PATCH body — zod strips unknown keys
 * silently, so this call succeeds but the flag will not persist until that validator is
 * extended. Flagged separately as a backend follow-up; not fixed here per scope (frontend only).
 */
export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => inventoryApi.updateItem(id, payload),
    onSuccess: () => {
      toast.success('Item updated');
      invalidateInv(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Update failed')),
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => inventoryApi.createSupplier(payload),
    onSuccess: () => {
      toast.success('Supplier created');
      invalidateInv(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Create failed')),
  });
}

export function useCreatePo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => inventoryApi.createPo(payload),
    onSuccess: () => {
      toast.success('Purchase order created');
      invalidateInv(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'PO failed')),
  });
}

export function usePharmacyDashboard() {
  return useQuery({
    queryKey: QUERY_KEYS.PHARMACY_DASHBOARD(),
    queryFn: async () => (await pharmacyApi.dashboard()).data,
  });
}

export function usePharmacyQueue() {
  return useQuery({
    queryKey: QUERY_KEYS.PHARMACY_QUEUE(),
    queryFn: async () => (await pharmacyApi.queue()).data,
  });
}

export function useDispense(id) {
  return useQuery({
    queryKey: QUERY_KEYS.PHARMACY_DISPENSE(id),
    queryFn: async () => (await pharmacyApi.getDispense(id)).data.dispense,
    enabled: Boolean(id),
  });
}

export function useStartDispense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => pharmacyApi.startDispense(payload),
    onSuccess: () => {
      toast.success('Dispense started');
      invalidateInv(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Start failed')),
  });
}

export function useDispenseItems(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => pharmacyApi.dispenseItems(id, payload),
    onSuccess: () => {
      toast.success('Dispensed');
      invalidateInv(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.PHARMACY_DISPENSE(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Dispense failed')),
  });
}

// --- Direct / retail sale (PHARM-DIRECT) ---
export function useSales(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.PHARMACY_SALES(params),
    queryFn: async () => {
      const res = await pharmacyApi.listSales(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => pharmacyApi.createSale(payload),
    onSuccess: () => {
      toast.success('Sale recorded');
      invalidateInv(qc);
      qc.invalidateQueries({ queryKey: ['pharmacy', 'sales'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Sale failed')),
  });
}

// --- Branch transfer workflow (INV-002) ---
export function useTransfers(params = {}) {
  return useQuery({
    queryKey: ['inventory', 'transfers', params],
    queryFn: async () => (await inventoryApi.listTransfers(params)).data.transfers || [],
  });
}

export function useRequestTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => inventoryApi.requestTransfer(payload),
    onSuccess: () => {
      toast.success('Transfer requested');
      qc.invalidateQueries({ queryKey: ['inventory', 'transfers'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not request transfer')),
  });
}

export function useApproveTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => inventoryApi.approveTransfer(id),
    onSuccess: () => {
      toast.success('Transfer approved');
      qc.invalidateQueries({ queryKey: ['inventory', 'transfers'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not approve')),
  });
}

export function useRejectTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => inventoryApi.rejectTransfer(id, reason),
    onSuccess: () => {
      toast.success('Transfer rejected');
      qc.invalidateQueries({ queryKey: ['inventory', 'transfers'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not reject')),
  });
}

export function useDispatchTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => inventoryApi.dispatchTransfer(id, payload),
    onSuccess: () => {
      toast.success('Transfer dispatched');
      invalidateInv(qc);
      qc.invalidateQueries({ queryKey: ['inventory', 'transfers'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not dispatch')),
  });
}

export function useReceiveTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => inventoryApi.receiveTransfer(id, payload),
    onSuccess: () => {
      toast.success('Transfer received');
      invalidateInv(qc);
      qc.invalidateQueries({ queryKey: ['inventory', 'transfers'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not receive')),
  });
}
