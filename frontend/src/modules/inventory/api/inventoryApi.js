import api from '@/services/api';

export const inventoryApi = {
  dashboard(params) {
    return api.get('/inventory/dashboard', { params }).then((r) => r.data);
  },
  listItems(params) {
    return api.get('/inventory/items', { params }).then((r) => r.data);
  },
  getItem(id) {
    return api.get(`/inventory/items/${id}`).then((r) => r.data);
  },
  createItem(payload) {
    return api.post('/inventory/items', payload).then((r) => r.data);
  },
  updateItem(id, payload) {
    return api.patch(`/inventory/items/${id}`, payload).then((r) => r.data);
  },
  adjust(payload) {
    return api.post('/inventory/adjust', payload).then((r) => r.data);
  },
  markDamaged(payload) {
    return api.post('/inventory/mark-damaged', payload).then((r) => r.data);
  },
  returnToVendor(payload) {
    return api.post('/inventory/return-to-vendor', payload).then((r) => r.data);
  },
  openingStock(payload) {
    return api.post('/inventory/opening-stock', payload).then((r) => r.data);
  },
  ledger(params) {
    return api.get('/inventory/ledger', { params }).then((r) => r.data);
  },
  report(type, params) {
    return api.get(`/inventory/reports/${type}`, { params }).then((r) => r.data);
  },
  async exportReport(type, params = {}) {
    const res = await api.get(`/inventory/reports/${type}/export`, {
      params,
      responseType: 'blob',
    });
    const disposition = res.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || `inventory-${type}-export`;
    return { blob: res.data, filename };
  },
  listSuppliers(params) {
    return api.get('/inventory/suppliers', { params }).then((r) => r.data);
  },
  createSupplier(payload) {
    return api.post('/inventory/suppliers', payload).then((r) => r.data);
  },
  listPos(params) {
    return api.get('/inventory/purchase-orders', { params }).then((r) => r.data);
  },
  createPo(payload) {
    return api.post('/inventory/purchase-orders', payload).then((r) => r.data);
  },
  submitPo(id) {
    return api.post(`/inventory/purchase-orders/${id}/submit`).then((r) => r.data);
  },
  createGrn(payload) {
    return api.post('/inventory/goods-receipts', payload).then((r) => r.data);
  },
  postGrn(id) {
    return api.post(`/inventory/goods-receipts/${id}/post`).then((r) => r.data);
  },

  // --- Branch transfer workflow (INV-002) ---
  requestTransfer(payload) {
    return api.post('/inventory/transfers', payload).then((r) => r.data);
  },
  listTransfers(params) {
    return api.get('/inventory/transfers', { params }).then((r) => r.data);
  },
  getTransfer(id) {
    return api.get(`/inventory/transfers/${id}`).then((r) => r.data);
  },
  approveTransfer(id) {
    return api.post(`/inventory/transfers/${id}/approve`).then((r) => r.data);
  },
  rejectTransfer(id, reason) {
    return api.post(`/inventory/transfers/${id}/reject`, { reason }).then((r) => r.data);
  },
  dispatchTransfer(id, payload) {
    return api.post(`/inventory/transfers/${id}/dispatch`, payload).then((r) => r.data);
  },
  receiveTransfer(id, payload) {
    return api.post(`/inventory/transfers/${id}/receive`, payload).then((r) => r.data);
  },

  // --- Stock adjustment approval queue (INV-003) ---
  listAdjustmentRequests(params) {
    return api.get('/inventory/adjustments', { params }).then((r) => r.data);
  },
  getAdjustmentRequest(id) {
    return api.get(`/inventory/adjustments/${id}`).then((r) => r.data);
  },
  approveAdjustmentRequest(id) {
    return api.post(`/inventory/adjustments/${id}/approve`).then((r) => r.data);
  },
  rejectAdjustmentRequest(id, reason) {
    return api.post(`/inventory/adjustments/${id}/reject`, { reason }).then((r) => r.data);
  },
};

export const pharmacyApi = {
  dashboard(params) {
    return api.get('/pharmacy/dashboard', { params }).then((r) => r.data);
  },
  queue(params) {
    return api.get('/pharmacy/queue', { params }).then((r) => r.data);
  },
  listDispenses(params) {
    return api.get('/pharmacy/dispenses', { params }).then((r) => r.data);
  },
  startDispense(payload) {
    return api.post('/pharmacy/dispenses', payload).then((r) => r.data);
  },
  getDispense(id) {
    return api.get(`/pharmacy/dispenses/${id}`).then((r) => r.data);
  },
  dispenseItems(id, payload) {
    return api.post(`/pharmacy/dispenses/${id}/dispense`, payload).then((r) => r.data);
  },

  // --- Direct / retail sale (PHARM-DIRECT) ---
  listSales(params) {
    return api.get('/pharmacy/sales', { params }).then((r) => r.data);
  },
  createSale(payload) {
    return api.post('/pharmacy/sales', payload).then((r) => r.data);
  },
};

export default inventoryApi;
