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

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => inventoryApi.adjust(payload),
    onSuccess: () => {
      toast.success('Stock adjusted');
      invalidateInv(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Adjust failed')),
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
