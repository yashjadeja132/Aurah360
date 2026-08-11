import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js';
import TreatmentPlan from '../../src/models/TreatmentPlan.model.js';
import TreatmentSession from '../../src/models/TreatmentSession.model.js';
import InventoryItem from '../../src/models/InventoryItem.model.js';
import Branch from '../../src/models/Branch.model.js';
import TreatmentSessionService from '../../src/services/TreatmentSessionService.js';
import { TREATMENT_SESSION_STATUS } from '../../src/enums/treatmentSession.js';
import { INVENTORY_ITEM_TYPE } from '../../src/enums/inventory.js';

/**
 * Round-2 gap fixes for Treatment Session execution:
 *  - pause()/resume() (mandatory-reason technician pause/resume, additive PAUSED status)
 *  - complete() atomicity (status + package-balance decrement + inventory consumption commit
 *    or roll back together, against the real replica set — this needs real transaction
 *    semantics, so a mocked Mongo would only assert the shape of the code, not the behaviour).
 *  - batch-linked consumablesUsed decrementing the exact batch selected for the session.
 */
describe('Treatment session execution — pause/resume, atomic complete, batch consumables', () => {
  const service = new TreatmentSessionService();
  const doctorId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();
  let branch;
  let seq = 0;

  async function newPlan({ packageSnapshot = null } = {}) {
    seq += 1;
    return TreatmentPlan.create({
      planNumber: `TP-EXEC-${Date.now()}-${seq}`,
      consultationId: new mongoose.Types.ObjectId(),
      patientId: new mongoose.Types.ObjectId(),
      doctorId,
      branchId: branch._id,
      title: 'Execution gap fixture',
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      packageSnapshot,
    });
  }

  async function newInProgressSession(plan, extra = {}) {
    seq += 1;
    return TreatmentSession.create({
      sessionNumber: `TS-EXEC-${Date.now()}-${seq}`,
      treatmentPlanId: plan._id,
      patientId: plan.patientId,
      doctorId,
      branchId: branch._id,
      status: TREATMENT_SESSION_STATUS.IN_PROGRESS,
      startedAt: new Date(),
      ...extra,
    });
  }

  async function newInventoryItem({ currentStock, batchNumber, batchQuantity }) {
    seq += 1;
    return InventoryItem.create({
      itemCode: `ITEM-EXEC-${Date.now()}-${seq}`,
      name: `Exec Consumable ${seq}`,
      itemType: INVENTORY_ITEM_TYPE.CONSUMABLE,
      branchId: branch._id,
      currentStock,
      batches: batchNumber ? [{ batchNumber, quantity: batchQuantity }] : [],
    });
  }

  beforeAll(async () => {
    await connectTestDb('trtexec');
    branch = await Branch.create({
      name: 'Exec Test Branch',
      branchCode: `EXB${Date.now()}`,
      displayName: 'Exec Test Branch',
      email: `exec-${Date.now()}@test.local`,
      phone: '9000000000',
    });
  }, 60_000);

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  describe('pause() / resume()', () => {
    it('pauses an IN_PROGRESS session with a mandatory reason and records pauseHistory', async () => {
      const plan = await newPlan();
      const session = await newInProgressSession(plan);

      const paused = await service.pause(session._id.toString(), { reason: 'Patient requested a break' }, actorId);
      expect(paused.status).toBe(TREATMENT_SESSION_STATUS.PAUSED);
      expect(paused.pauseHistory).toHaveLength(1);
      expect(paused.pauseHistory[0].reason).toBe('Patient requested a break');
      expect(paused.pauseHistory[0].resumedAt).toBeNull();
      expect(paused.pauseHistory[0].actorId).toBe(actorId.toString());
    });

    it('rejects pause without a reason', async () => {
      const plan = await newPlan();
      const session = await newInProgressSession(plan);
      await expect(service.pause(session._id.toString(), {}, actorId)).rejects.toThrow(/reason/i);
    });

    it('rejects pause from a non-IN_PROGRESS session', async () => {
      const plan = await newPlan();
      const session = await TreatmentSession.create({
        sessionNumber: `TS-EXEC-${Date.now()}-${++seq}`,
        treatmentPlanId: plan._id,
        patientId: plan.patientId,
        doctorId,
        branchId: branch._id,
        status: TREATMENT_SESSION_STATUS.SCHEDULED,
      });
      await expect(
        service.pause(session._id.toString(), { reason: 'irrelevant' }, actorId)
      ).rejects.toThrow(/in-progress/i);
    });

    it('resumes a PAUSED session back to IN_PROGRESS and closes out the open pauseHistory entry', async () => {
      const plan = await newPlan();
      const session = await newInProgressSession(plan);
      await service.pause(session._id.toString(), { reason: 'Device recalibration' }, actorId);

      const resumed = await service.resume(session._id.toString(), actorId);
      expect(resumed.status).toBe(TREATMENT_SESSION_STATUS.IN_PROGRESS);
      expect(resumed.pauseHistory).toHaveLength(1);
      expect(resumed.pauseHistory[0].resumedAt).not.toBeNull();
    });

    it('rejects resume from a non-PAUSED session', async () => {
      const plan = await newPlan();
      const session = await newInProgressSession(plan);
      await expect(service.resume(session._id.toString(), actorId)).rejects.toThrow(/paused/i);
    });
  });

  describe('complete() atomicity', () => {
    it('commits status, package-balance decrement and inventory consumption together', async () => {
      const plan = await newPlan({ packageSnapshot: { packageName: 'Facial x5', unusedSessions: 3, maximumSessions: 5 } });
      const item = await newInventoryItem({ currentStock: 10, batchNumber: 'BATCH-A', batchQuantity: 10 });
      const session = await newInProgressSession(plan);

      const completed = await service.complete(
        session._id.toString(),
        { consumablesUsed: [{ inventoryItemId: item._id.toString(), batchNumber: 'BATCH-A', quantity: 2 }] },
        actorId
      );

      expect(completed.status).toBe(TREATMENT_SESSION_STATUS.COMPLETED);
      expect(completed.consumablesUsed).toHaveLength(1);
      expect(completed.consumablesUsed[0].batchNumber).toBe('BATCH-A');

      const refreshedPlan = await TreatmentPlan.findById(plan._id).exec();
      expect(refreshedPlan.packageSnapshot.unusedSessions).toBe(2);

      const refreshedItem = await InventoryItem.findById(item._id).exec();
      expect(refreshedItem.currentStock).toBe(8);
      expect(refreshedItem.batches.find((b) => b.batchNumber === 'BATCH-A').quantity).toBe(8);
    });

    it('rolls back the status flip and the package-balance decrement when inventory deduction fails (insufficient batch stock)', async () => {
      const plan = await newPlan({ packageSnapshot: { packageName: 'Facial x5', unusedSessions: 3, maximumSessions: 5 } });
      const item = await newInventoryItem({ currentStock: 1, batchNumber: 'BATCH-B', batchQuantity: 1 });
      const session = await newInProgressSession(plan);

      await expect(
        service.complete(
          session._id.toString(),
          { consumablesUsed: [{ inventoryItemId: item._id.toString(), batchNumber: 'BATCH-B', quantity: 5 }] },
          actorId
        )
      ).rejects.toThrow(/insufficient/i);

      const refreshedSession = await TreatmentSession.findById(session._id).exec();
      expect(refreshedSession.status).toBe(TREATMENT_SESSION_STATUS.IN_PROGRESS);
      expect(refreshedSession.completedAt).toBeNull();

      const refreshedPlan = await TreatmentPlan.findById(plan._id).exec();
      expect(refreshedPlan.packageSnapshot.unusedSessions).toBe(3);

      const refreshedItem = await InventoryItem.findById(item._id).exec();
      expect(refreshedItem.currentStock).toBe(1);
    });

    it('decrements the specific batch named on a batch-linked consumable, not a generic name match', async () => {
      const plan = await newPlan();
      const itemOldBatch = await newInventoryItem({ currentStock: 5, batchNumber: 'OLD-BATCH', batchQuantity: 5 });
      // Same item — add a second, newer batch so a name-only match would pick FEFO instead.
      itemOldBatch.batches.push({ batchNumber: 'NEW-BATCH', quantity: 5, expiryDate: null });
      itemOldBatch.currentStock = 10;
      await itemOldBatch.save();

      const session = await newInProgressSession(plan);
      await service.complete(
        session._id.toString(),
        {
          consumablesUsed: [
            { inventoryItemId: itemOldBatch._id.toString(), batchNumber: 'NEW-BATCH', quantity: 3, productName: 'Exec Consumable' },
          ],
        },
        actorId
      );

      const refreshed = await InventoryItem.findById(itemOldBatch._id).exec();
      expect(refreshed.batches.find((b) => b.batchNumber === 'NEW-BATCH').quantity).toBe(2);
      expect(refreshed.batches.find((b) => b.batchNumber === 'OLD-BATCH').quantity).toBe(5);
    });
  });
});
