import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import App from '../../src/app.js';
import User from '../../src/models/User.model.js';
import Role from '../../src/models/Role.model.js';
import Branch from '../../src/models/Branch.model.js';
import Doctor from '../../src/models/Doctor.model.js';
import InventoryItem from '../../src/models/InventoryItem.model.js';
import StockTransaction from '../../src/models/StockTransaction.model.js';
import StockTransferRequest from '../../src/models/StockTransferRequest.model.js';
import PurchaseOrder from '../../src/models/PurchaseOrder.model.js';
import Supplier from '../../src/models/Supplier.model.js';
import Room from '../../src/models/Room.model.js';
import Device from '../../src/models/Device.model.js';
import StaffSkill from '../../src/models/StaffSkill.model.js';
import BranchHoliday from '../../src/models/BranchHoliday.model.js';
import DoctorBlockedSlot from '../../src/models/DoctorBlockedSlot.model.js';
import DoctorSpecialSchedule from '../../src/models/DoctorSpecialSchedule.model.js';
import TokenService from '../../src/services/TokenService.js';
import { hashPassword } from '../../src/helpers/crypto.helper.js';
import { ROLE_PERMISSIONS } from '../../src/constants/rolePermissions.js';
import { ROLES, ROLE_LABELS } from '../../src/constants/roles.js';

/**
 * SEC-030 — row-level branch scoping for INVENTORY, RESOURCES and SCHEDULING.
 *
 * Regression cover for the reported defect: these controllers forwarded `req.query` straight to
 * their repositories, so a branch-scoped BRANCH_MANAGER / PHARMACIST browsed every branch's stock,
 * rooms, devices, purchase orders and calendars — and could adjust or dispatch stock that was not
 * theirs.
 *
 * Each endpoint is asserted in BOTH directions, because a scope that returns nothing is an outage
 * rather than a fix:
 *   - the branch-scoped caller is refused the OTHER branch's rows, AND still served their own;
 *   - OWNER (global scope) still sees every branch.
 *
 * Out-of-scope SINGLE records answer 404, never 403: a 403 would confirm to an enumerating caller
 * that the id exists and tell them it belongs to someone else.
 *
 * The interesting case is STOCK TRANSFERS, which are inherently cross-branch. Branch A must see
 * the transfer B is sending it (otherwise it can never receive it), so the rule is "my branch is a
 * PARTY to this transfer" — not `fromBranchId === mine`. A transfer between two OTHER branches
 * stays invisible.
 */
describe('SEC-030 inventory / resource / scheduling branch scoping', () => {
  let app;
  const tokenService = new TokenService();

  let branchA;
  let branchB;
  let branchC;
  let itemA;
  let itemB;
  let doctor;
  let roomA;
  let roomB;
  let holidayA;
  let holidayB;
  let specialA;
  let specialB;
  let transferAtoB;
  let transferBtoA;
  let transferBtoC;
  let inTransitBtoA;
  let poA;
  let poB;
  let skillA;
  let skillB;
  let skillGlobal;

  let tokenManagerA;
  let tokenManagerB;
  let tokenPharmacistA;
  let tokenOwner;

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  const mintToken = async (user) =>
    tokenService.signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      permissions: user.role === ROLES.OWNER ? ['*'] : ROLE_PERMISSIONS[user.role] || [],
      branch: user.branch ? user.branch.toString() : null,
    });

  const makeBranch = (code) =>
    Branch.create({
      name: `Branch ${code}`,
      displayName: `Branch ${code}`,
      branchCode: code,
      email: `${code.toLowerCase()}@invscope.test`,
      phone: '9000000000',
    });

  const makeUser = async ({ email, role, branch }) =>
    User.create({
      firstName: role,
      lastName: email.split('@')[0],
      email,
      passwordHash: await hashPassword('Password@12345'),
      employeeId: `EMP-${email.split('@')[0].toUpperCase()}`,
      role,
      branch: branch || null,
      isActive: true,
      status: 'ACTIVE',
    });

  const makeItem = (code, branchId) =>
    InventoryItem.create({
      itemCode: code,
      name: `Item ${code}`,
      itemType: 'CONSUMABLE',
      branchId,
      currentStock: 100,
      minimumStock: 1,
      reorderLevel: 2,
      maximumStock: 1000,
    });

  beforeAll(async () => {
    await connectTestDb('invscope');
    app = new App().getExpressApp();

    for (const code of [ROLES.OWNER, ROLES.BRANCH_MANAGER, ROLES.PHARMACIST]) {
      await Role.findOneAndUpdate(
        { code },
        {
          code,
          name: ROLE_LABELS[code],
          permissions: code === ROLES.OWNER ? ['*'] : ROLE_PERMISSIONS[code],
          isSystem: true,
          isActive: true,
        },
        { upsert: true }
      );
    }

    branchA = await makeBranch('INVS-A');
    branchB = await makeBranch('INVS-B');
    branchC = await makeBranch('INVS-C');

    const managerA = await makeUser({
      email: 'invscope.mgr.a@test.local',
      role: ROLES.BRANCH_MANAGER,
      branch: branchA._id,
    });
    const managerB = await makeUser({
      email: 'invscope.mgr.b@test.local',
      role: ROLES.BRANCH_MANAGER,
      branch: branchB._id,
    });
    const pharmacistA = await makeUser({
      email: 'invscope.rx.a@test.local',
      role: ROLES.PHARMACIST,
      branch: branchA._id,
    });
    // OWNER is deliberately branch-less: OWNER/ADMIN are the roles that span every branch.
    const owner = await makeUser({ email: 'invscope.owner@test.local', role: ROLES.OWNER });

    tokenManagerA = await mintToken(managerA);
    tokenManagerB = await mintToken(managerB);
    tokenPharmacistA = await mintToken(pharmacistA);
    tokenOwner = await mintToken(owner);

    const doctorUser = await makeUser({
      email: 'invscope.doc@test.local',
      role: ROLES.BRANCH_MANAGER,
      branch: branchA._id,
    });
    doctor = await Doctor.create({
      userId: doctorUser._id,
      doctorCode: 'INVS-D',
      licenseNumber: 'LIC-INVS-D',
      registrationNumber: 'REG-INVS-D',
    });

    // --- inventory -------------------------------------------------------
    itemA = await makeItem('ITM-INVS-A', branchA._id);
    itemB = await makeItem('ITM-INVS-B', branchB._id);

    await StockTransaction.create({
      transactionNumber: 'STX-INVS-A',
      type: 'ADJUSTMENT',
      inventoryItemId: itemA._id,
      branchId: branchA._id,
      quantity: 5,
      balanceAfter: 105,
    });
    await StockTransaction.create({
      transactionNumber: 'STX-INVS-B',
      type: 'ADJUSTMENT',
      inventoryItemId: itemB._id,
      branchId: branchB._id,
      quantity: 7,
      balanceAfter: 107,
    });

    const makeTransfer = (number, from, to, extra = {}) =>
      StockTransferRequest.create({
        transferNumber: number,
        fromBranchId: from,
        toBranchId: to,
        fromItemId: from.equals(branchA._id) ? itemA._id : itemB._id,
        quantityRequested: 5,
        requestedBy: managerA._id,
        ...extra,
      });

    transferAtoB = await makeTransfer('TRF-INVS-AB', branchA._id, branchB._id);
    transferBtoA = await makeTransfer('TRF-INVS-BA', branchB._id, branchA._id);
    transferBtoC = await makeTransfer('TRF-INVS-BC', branchB._id, branchC._id);
    inTransitBtoA = await makeTransfer('TRF-INVS-BA2', branchB._id, branchA._id, {
      status: 'IN_TRANSIT',
      quantityDispatched: 5,
      batchNumber: 'BATCH-INVS',
    });

    const supplier = await Supplier.create({
      supplierCode: 'SUP-INVS',
      name: 'Shared Vendor',
    });
    poA = await PurchaseOrder.create({
      poNumber: 'PO-INVS-A',
      supplierId: supplier._id,
      branchId: branchA._id,
      items: [{ name: 'Gauze', quantityOrdered: 10, unitCost: 5 }],
    });
    poB = await PurchaseOrder.create({
      poNumber: 'PO-INVS-B',
      supplierId: supplier._id,
      branchId: branchB._id,
      items: [{ name: 'Gauze', quantityOrdered: 10, unitCost: 5 }],
    });

    // --- resources -------------------------------------------------------
    roomA = await Room.create({ branchId: branchA._id, name: 'Room A', code: 'RA' });
    roomB = await Room.create({ branchId: branchB._id, name: 'Room B', code: 'RB' });
    await Device.create({ branchId: branchA._id, name: 'Laser A', code: 'DA' });
    await Device.create({ branchId: branchB._id, name: 'Laser B', code: 'DB' });

    skillA = await StaffSkill.create({
      userId: managerA._id,
      branchId: branchA._id,
      skillCode: 'LASER-A',
      name: 'Laser A',
    });
    skillB = await StaffSkill.create({
      userId: managerB._id,
      branchId: branchB._id,
      skillCode: 'LASER-B',
      name: 'Laser B',
    });
    // branchId null == "valid at every branch" — exactly how findValidSkill reads it at booking
    // time, so a branch must still SEE it.
    skillGlobal = await StaffSkill.create({
      userId: managerA._id,
      branchId: null,
      skillCode: 'ORG-WIDE',
      name: 'Org wide credential',
    });

    // --- scheduling ------------------------------------------------------
    holidayA = await BranchHoliday.create({
      branchId: branchA._id,
      holidayName: 'A Day',
      date: new Date('2030-01-01'),
    });
    holidayB = await BranchHoliday.create({
      branchId: branchB._id,
      holidayName: 'B Day',
      date: new Date('2030-01-02'),
    });

    await DoctorBlockedSlot.create({
      doctorId: doctor._id,
      branchId: branchA._id,
      title: 'Block A',
      startAt: new Date('2030-02-01T09:00:00Z'),
      endAt: new Date('2030-02-01T10:00:00Z'),
    });
    await DoctorBlockedSlot.create({
      doctorId: doctor._id,
      branchId: branchB._id,
      title: 'Block B',
      startAt: new Date('2030-02-02T09:00:00Z'),
      endAt: new Date('2030-02-02T10:00:00Z'),
    });
    await DoctorBlockedSlot.create({
      doctorId: doctor._id,
      branchId: null,
      title: 'Block Everywhere',
      startAt: new Date('2030-02-03T09:00:00Z'),
      endAt: new Date('2030-02-03T10:00:00Z'),
    });

    specialA = await DoctorSpecialSchedule.create({
      doctorId: doctor._id,
      branchId: branchA._id,
      date: new Date('2030-03-01'),
      startTime: '09:00',
      endTime: '17:00',
    });
    specialB = await DoctorSpecialSchedule.create({
      doctorId: doctor._id,
      branchId: branchB._id,
      date: new Date('2030-03-02'),
      startTime: '09:00',
      endTime: '17:00',
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  // =====================================================================
  describe('inventory items', () => {
    it('serves branch A only its own items', async () => {
      const res = await request(app).get('/api/v1/inventory/items').set(auth(tokenManagerA));
      expect(res.status).toBe(200);
      const codes = res.body.data.map((i) => i.itemCode);
      expect(codes).toContain('ITM-INVS-A');
      expect(codes).not.toContain('ITM-INVS-B');
    });

    it('serves branch B only its own items', async () => {
      const res = await request(app).get('/api/v1/inventory/items').set(auth(tokenManagerB));
      expect(res.status).toBe(200);
      const codes = res.body.data.map((i) => i.itemCode);
      expect(codes).toContain('ITM-INVS-B');
      expect(codes).not.toContain('ITM-INVS-A');
    });

    it('OWNER still sees every branch\'s items', async () => {
      const res = await request(app).get('/api/v1/inventory/items').set(auth(tokenOwner));
      expect(res.status).toBe(200);
      const codes = res.body.data.map((i) => i.itemCode);
      expect(codes).toEqual(expect.arrayContaining(['ITM-INVS-A', 'ITM-INVS-B']));
    });

    it('rejects an out-of-scope branchId on the item list rather than honouring it', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/items')
        .query({ branchId: branchB._id.toString() })
        .set(auth(tokenManagerA));
      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('BRANCH_SCOPE_VIOLATION');
    });

    it('answers 404 (not 403) for another branch\'s item by id', async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/items/${itemB._id}`)
        .set(auth(tokenManagerA));
      expect(res.status).toBe(404);
    });

    it('still serves the caller\'s own item by id, and OWNER either', async () => {
      const own = await request(app)
        .get(`/api/v1/inventory/items/${itemA._id}`)
        .set(auth(tokenManagerA));
      expect(own.status).toBe(200);
      expect(own.body.data.item.itemCode).toBe('ITM-INVS-A');

      const owner = await request(app)
        .get(`/api/v1/inventory/items/${itemB._id}`)
        .set(auth(tokenOwner));
      expect(owner.status).toBe(200);
    });

    it('refuses to create an item in another branch', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .send({ name: 'Sneaky', itemType: 'CONSUMABLE', branchId: branchB._id.toString() })
        .set(auth(tokenManagerA));
      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('BRANCH_SCOPE_VIOLATION');
    });

    it('scopes the dashboard totals to the caller\'s branch', async () => {
      const mine = await request(app).get('/api/v1/inventory/dashboard').set(auth(tokenManagerA));
      const all = await request(app).get('/api/v1/inventory/dashboard').set(auth(tokenOwner));
      expect(mine.status).toBe(200);
      expect(mine.body.data.summary.totalItems).toBe(1);
      expect(all.body.data.summary.totalItems).toBeGreaterThan(1);
    });

    it('scopes the stock ledger to the caller\'s branch', async () => {
      const res = await request(app).get('/api/v1/inventory/ledger').set(auth(tokenManagerA));
      expect(res.status).toBe(200);
      const numbers = res.body.data.map((t) => t.transactionNumber);
      expect(numbers).toContain('STX-INVS-A');
      expect(numbers).not.toContain('STX-INVS-B');
    });
  });

  // =====================================================================
  describe('stock WRITES are scoped, not just reads', () => {
    it('refuses to adjust another branch\'s stock (404, not 403)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/adjust')
        .send({ inventoryItemId: itemB._id.toString(), quantity: -5, reason: 'shrinkage' })
        .set(auth(tokenManagerA));
      expect(res.status).toBe(404);

      const untouched = await InventoryItem.findById(itemB._id);
      expect(untouched.currentStock).toBe(100);
    });

    it('still lets the caller adjust their OWN branch\'s stock', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/adjust')
        .send({ inventoryItemId: itemA._id.toString(), quantity: -5, reason: 'shrinkage' })
        .set(auth(tokenManagerA));
      expect(res.status).toBe(200);
      expect(res.body.data.item.currentStock).toBe(95);
    });

    it('refuses to transfer stock OUT of another branch', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/transfer')
        .send({
          fromItemId: itemB._id.toString(),
          toBranchId: branchA._id.toString(),
          quantity: 5,
        })
        .set(auth(tokenManagerA));
      expect(res.status).toBe(404);
    });

    it('refuses a stock count against another branch\'s item', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/stock-count')
        .send({ inventoryItemId: itemB._id.toString(), countedQuantity: 0 })
        .set(auth(tokenManagerA));
      expect(res.status).toBe(404);
    });
  });

  // =====================================================================
  describe('stock transfers (cross-branch by nature)', () => {
    it('shows a branch both its OUTBOUND and its INBOUND transfers', async () => {
      const res = await request(app).get('/api/v1/inventory/transfers').set(auth(tokenManagerA));
      expect(res.status).toBe(200);
      const numbers = res.body.data.transfers.map((t) => t.transferNumber);
      // Outbound (A is the source) …
      expect(numbers).toContain('TRF-INVS-AB');
      // … and inbound (A is the destination). Scoping on `fromBranchId === mine` would have hidden
      // this one, leaving branch A unable to see stock it is meant to receive.
      expect(numbers).toContain('TRF-INVS-BA');
      // A transfer between two OTHER branches stays invisible.
      expect(numbers).not.toContain('TRF-INVS-BC');
    });

    it('OWNER sees transfers between every pair of branches', async () => {
      const res = await request(app).get('/api/v1/inventory/transfers').set(auth(tokenOwner));
      expect(res.status).toBe(200);
      const numbers = res.body.data.transfers.map((t) => t.transferNumber);
      expect(numbers).toEqual(
        expect.arrayContaining(['TRF-INVS-AB', 'TRF-INVS-BA', 'TRF-INVS-BC'])
      );
    });

    it('lets a party open a transfer by id but 404s a non-party', async () => {
      const inbound = await request(app)
        .get(`/api/v1/inventory/transfers/${transferBtoA._id}`)
        .set(auth(tokenManagerA));
      expect(inbound.status).toBe(200);
      expect(inbound.body.data.transfer.transferNumber).toBe('TRF-INVS-BA');

      const outbound = await request(app)
        .get(`/api/v1/inventory/transfers/${transferAtoB._id}`)
        .set(auth(tokenManagerA));
      expect(outbound.status).toBe(200);

      const foreign = await request(app)
        .get(`/api/v1/inventory/transfers/${transferBtoC._id}`)
        .set(auth(tokenManagerA));
      expect(foreign.status).toBe(404);
    });

    it('refuses to approve a transfer the caller is not a party to', async () => {
      const res = await request(app)
        .post(`/api/v1/inventory/transfers/${transferBtoC._id}/approve`)
        .set(auth(tokenManagerA));
      expect(res.status).toBe(404);
      expect((await StockTransferRequest.findById(transferBtoC._id)).status).toBe('REQUESTED');
    });

    it('lets a party approve a transfer it IS involved in', async () => {
      const res = await request(app)
        .post(`/api/v1/inventory/transfers/${transferBtoA._id}/approve`)
        .set(auth(tokenManagerA));
      expect(res.status).toBe(200);
      expect(res.body.data.transfer.status).toBe('APPROVED');
    });

    it('refuses a transfer request that involves neither end of the caller\'s branch', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/transfers')
        .send({
          fromBranchId: branchB._id.toString(),
          toBranchId: branchC._id.toString(),
          fromItemId: itemB._id.toString(),
          quantityRequested: 3,
        })
        .set(auth(tokenPharmacistA));
      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('BRANCH_SCOPE_VIOLATION');
    });

    it('allows a transfer request that PULLS stock into the caller\'s own branch', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/transfers')
        .send({
          fromBranchId: branchB._id.toString(),
          toBranchId: branchA._id.toString(),
          fromItemId: itemB._id.toString(),
          quantityRequested: 3,
        })
        .set(auth(tokenPharmacistA));
      expect(res.status).toBe(201);
    });

    it('lets only the DESTINATION receive, and only the SOURCE dispatch', async () => {
      // Branch B is the source of the in-transit transfer, so it may not receive it …
      const wrongEnd = await request(app)
        .post(`/api/v1/inventory/transfers/${inTransitBtoA._id}/receive`)
        .send({ quantityReceived: 5 })
        .set(auth(tokenManagerB));
      expect(wrongEnd.status).toBe(403);

      // … but branch A, the destination, may.
      const rightEnd = await request(app)
        .post(`/api/v1/inventory/transfers/${inTransitBtoA._id}/receive`)
        .send({ quantityReceived: 5 })
        .set(auth(tokenManagerA));
      expect(rightEnd.status).toBe(200);
      expect(rightEnd.body.data.transfer.status).toBe('RECEIVED');
    });
  });

  // =====================================================================
  describe('purchase orders and the org-wide supplier master', () => {
    it('scopes the PO list to the caller\'s branch', async () => {
      const mine = await request(app)
        .get('/api/v1/inventory/purchase-orders')
        .set(auth(tokenManagerA));
      expect(mine.status).toBe(200);
      const numbers = mine.body.data.map((p) => p.poNumber);
      expect(numbers).toContain('PO-INVS-A');
      expect(numbers).not.toContain('PO-INVS-B');

      const all = await request(app)
        .get('/api/v1/inventory/purchase-orders')
        .set(auth(tokenOwner));
      expect(all.body.data.map((p) => p.poNumber)).toEqual(
        expect.arrayContaining(['PO-INVS-A', 'PO-INVS-B'])
      );
    });

    it('404s another branch\'s PO by id but serves the caller\'s own', async () => {
      const foreign = await request(app)
        .get(`/api/v1/inventory/purchase-orders/${poB._id}`)
        .set(auth(tokenManagerA));
      expect(foreign.status).toBe(404);

      const own = await request(app)
        .get(`/api/v1/inventory/purchase-orders/${poA._id}`)
        .set(auth(tokenManagerA));
      expect(own.status).toBe(200);
    });

    it('leaves the SUPPLIER master organisation-wide (it has no branch dimension)', async () => {
      // Supplier carries no branchId at all — one shared vendor list every branch orders against.
      // Scoping it would fragment the catalogue for no security gain.
      const a = await request(app).get('/api/v1/inventory/suppliers').set(auth(tokenManagerA));
      const b = await request(app).get('/api/v1/inventory/suppliers').set(auth(tokenManagerB));
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(a.body.data.map((s) => s.supplierCode)).toContain('SUP-INVS');
      expect(b.body.data.map((s) => s.supplierCode)).toContain('SUP-INVS');
    });
  });

  // =====================================================================
  describe('resources — rooms, devices, skills', () => {
    it('scopes the room list both ways and leaves OWNER unrestricted', async () => {
      const a = await request(app).get('/api/v1/resources/rooms').set(auth(tokenManagerA));
      expect(a.status).toBe(200);
      expect(a.body.data.rooms.map((r) => r.code)).toEqual(['RA']);

      const b = await request(app).get('/api/v1/resources/rooms').set(auth(tokenManagerB));
      expect(b.body.data.rooms.map((r) => r.code)).toEqual(['RB']);

      const owner = await request(app).get('/api/v1/resources/rooms').set(auth(tokenOwner));
      expect(owner.body.data.rooms.map((r) => r.code)).toEqual(
        expect.arrayContaining(['RA', 'RB'])
      );
    });

    it('scopes the device list both ways', async () => {
      const a = await request(app).get('/api/v1/resources/devices').set(auth(tokenManagerA));
      expect(a.status).toBe(200);
      expect(a.body.data.devices.map((d) => d.code)).toEqual(['DA']);

      const owner = await request(app).get('/api/v1/resources/devices').set(auth(tokenOwner));
      expect(owner.body.data.devices.map((d) => d.code)).toEqual(
        expect.arrayContaining(['DA', 'DB'])
      );
    });

    it('404s an edit of another branch\'s room and still allows the caller\'s own', async () => {
      const foreign = await request(app)
        .patch(`/api/v1/resources/rooms/${roomB._id}`)
        .send({ name: 'Hijacked' })
        .set(auth(tokenManagerA));
      expect(foreign.status).toBe(404);
      expect((await Room.findById(roomB._id)).name).toBe('Room B');

      const own = await request(app)
        .patch(`/api/v1/resources/rooms/${roomA._id}`)
        .send({ name: 'Room A renamed' })
        .set(auth(tokenManagerA));
      expect(own.status).toBe(200);
    });

    it('403s a room created into another branch', async () => {
      const res = await request(app)
        .post('/api/v1/resources/rooms')
        .send({ branchId: branchB._id.toString(), name: 'Planted', code: 'PL' })
        .set(auth(tokenManagerA));
      expect(res.status).toBe(403);
    });

    it('shows a branch its own skill grants PLUS the org-wide ones, never another branch\'s', async () => {
      const res = await request(app).get('/api/v1/resources/skills').set(auth(tokenManagerA));
      expect(res.status).toBe(200);
      const codes = res.body.data.skills.map((s) => s.skillCode);
      expect(codes).toContain('LASER-A');
      // branchId null means "valid everywhere" — hiding it would blind the branch to the
      // credential its own staff actually work under.
      expect(codes).toContain('ORG-WIDE');
      expect(codes).not.toContain('LASER-B');
    });

    it('404s a revoke of another branch\'s skill grant, and leaves it ACTIVE', async () => {
      const res = await request(app)
        .post(`/api/v1/resources/skills/${skillB._id}/revoke`)
        .set(auth(tokenManagerA));
      expect(res.status).toBe(404);
      expect((await StaffSkill.findById(skillB._id)).status).toBe('ACTIVE');
    });

    it('still lets a branch revoke its OWN grant', async () => {
      const res = await request(app)
        .post(`/api/v1/resources/skills/${skillA._id}/revoke`)
        .set(auth(tokenManagerA));
      expect(res.status).toBe(200);
      expect(res.body.data.skill.status).toBe('SUSPENDED');
    });

    it('lets OWNER revoke an organisation-wide grant', async () => {
      const res = await request(app)
        .post(`/api/v1/resources/skills/${skillGlobal._id}/revoke`)
        .set(auth(tokenOwner));
      expect(res.status).toBe(200);
    });
  });

  // =====================================================================
  describe('scheduling — holidays, blocked slots, special schedules', () => {
    it('rejects a holiday list aimed at another branch and serves the caller\'s own', async () => {
      const foreign = await request(app)
        .get('/api/v1/scheduling/holidays')
        .query({ branchId: branchB._id.toString() })
        .set(auth(tokenManagerA));
      expect(foreign.status).toBe(403);
      expect(foreign.body.error?.code || foreign.body.code).toBe('BRANCH_SCOPE_VIOLATION');

      const own = await request(app)
        .get('/api/v1/scheduling/holidays')
        .query({ branchId: branchA._id.toString() })
        .set(auth(tokenManagerA));
      expect(own.status).toBe(200);
      expect(own.body.data.map((h) => h.holidayName)).toEqual(['A Day']);
    });

    it('lets OWNER read any branch\'s holidays', async () => {
      const res = await request(app)
        .get('/api/v1/scheduling/holidays')
        .query({ branchId: branchB._id.toString() })
        .set(auth(tokenOwner));
      expect(res.status).toBe(200);
      expect(res.body.data.map((h) => h.holidayName)).toEqual(['B Day']);
    });

    it('404s an edit or delete of another branch\'s holiday, and still allows its own', async () => {
      const edit = await request(app)
        .patch(`/api/v1/scheduling/holidays/${holidayB._id}`)
        .send({ holidayName: 'Hijacked' })
        .set(auth(tokenManagerA));
      expect(edit.status).toBe(404);
      expect((await BranchHoliday.findById(holidayB._id)).holidayName).toBe('B Day');

      const del = await request(app)
        .delete(`/api/v1/scheduling/holidays/${holidayB._id}`)
        .set(auth(tokenManagerA));
      expect(del.status).toBe(404);
      expect((await BranchHoliday.findById(holidayB._id)).deletedAt).toBeNull();

      const own = await request(app)
        .patch(`/api/v1/scheduling/holidays/${holidayA._id}`)
        .send({ holidayName: 'A Day renamed' })
        .set(auth(tokenManagerA));
      expect(own.status).toBe(200);
    });

    it('403s a holiday created into another branch', async () => {
      const res = await request(app)
        .post('/api/v1/scheduling/holidays')
        .send({
          branchId: branchB._id.toString(),
          holidayName: 'Planted',
          date: '2030-06-01',
        })
        .set(auth(tokenManagerA));
      expect(res.status).toBe(403);
    });

    it('scopes blocked slots to the branch, keeping the org-wide (null-branch) blocks visible', async () => {
      const res = await request(app)
        .get('/api/v1/scheduling/blocked-slots')
        .query({ doctorId: doctor._id.toString() })
        .set(auth(tokenManagerA));
      expect(res.status).toBe(200);
      const titles = res.body.data.map((b) => b.title);
      expect(titles).toContain('Block A');
      expect(titles).toContain('Block Everywhere');
      expect(titles).not.toContain('Block B');

      const owner = await request(app)
        .get('/api/v1/scheduling/blocked-slots')
        .query({ doctorId: doctor._id.toString() })
        .set(auth(tokenOwner));
      expect(owner.body.data.map((b) => b.title)).toEqual(
        expect.arrayContaining(['Block A', 'Block B', 'Block Everywhere'])
      );
    });

    it('scopes special schedules and 404s a delete of another branch\'s', async () => {
      const list = await request(app)
        .get('/api/v1/scheduling/special-schedules')
        .query({ doctorId: doctor._id.toString() })
        .set(auth(tokenManagerA));
      expect(list.status).toBe(200);
      expect(list.body.data.map((s) => s.branchId)).toEqual([branchA._id.toString()]);

      const foreign = await request(app)
        .delete(`/api/v1/scheduling/special-schedules/${specialB._id}`)
        .set(auth(tokenManagerA));
      expect(foreign.status).toBe(404);
      expect((await DoctorSpecialSchedule.findById(specialB._id)).deletedAt).toBeNull();

      const own = await request(app)
        .delete(`/api/v1/scheduling/special-schedules/${specialA._id}`)
        .set(auth(tokenManagerA));
      expect(own.status).toBe(200);
    });

    it('403s a special schedule upserted into another branch', async () => {
      const res = await request(app)
        .put('/api/v1/scheduling/special-schedules')
        .send({
          doctorId: doctor._id.toString(),
          branchId: branchB._id.toString(),
          date: '2030-04-01',
          startTime: '09:00',
          endTime: '17:00',
        })
        .set(auth(tokenManagerA));
      expect(res.status).toBe(403);
    });
  });
});
