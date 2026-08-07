/**
 * Ad-hoc smoke test for Task #44 (not part of Vitest).
 *
 * Proves that TreatmentPlanService#normalizeItems() no longer silently drops
 * `parameters`, `patchTestRequired`, `consentRequired`, and `requiredSkillCode`
 * from protocol items — on both createProtocol() and createNewProtocolVersion().
 */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import TreatmentPlanService from '../services/TreatmentPlanService.js';

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log('OK:', message);
}

async function main() {
  await mongoose.connect(config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_protocol_item_fields'));
  await mongoose.connection.dropDatabase();

  const planService = new TreatmentPlanService();
  const actorId = new mongoose.Types.ObjectId();

  // 1. Create a protocol with items setting all four fields.
  const protocolV1 = await planService.createProtocol(
    {
      name: 'Chemical Peel',
      category: 'Skin',
      estimatedSessions: 3,
      items: [
        {
          procedureName: 'Glycolic Peel',
          parameters: { concentration: 30, duration: 10 },
          patchTestRequired: true,
          consentRequired: true,
          requiredSkillCode: 'ESTH-L2',
        },
      ],
    },
    actorId
  );

  const reloadedV1 = await planService.getProtocol(protocolV1.id);
  const itemV1 = reloadedV1.items[0];
  assert(
    itemV1.parameters?.concentration === 30 && itemV1.parameters?.duration === 10,
    `v1 item parameters round-trip correctly (got ${JSON.stringify(itemV1.parameters)})`
  );
  assert(itemV1.patchTestRequired === true, `v1 item patchTestRequired round-trips as true (got ${itemV1.patchTestRequired})`);
  assert(itemV1.consentRequired === true, `v1 item consentRequired round-trips as true (got ${itemV1.consentRequired})`);
  assert(
    itemV1.requiredSkillCode === 'ESTH-L2',
    `v1 item requiredSkillCode round-trips correctly (got ${itemV1.requiredSkillCode})`
  );

  // 2. Create a new version with different values for all four fields — must also persist.
  const protocolV2 = await planService.createNewProtocolVersion(
    protocolV1.id,
    {
      items: [
        {
          procedureName: 'Glycolic Peel',
          parameters: { concentration: 40, duration: 15 },
          patchTestRequired: false,
          consentRequired: false,
          requiredSkillCode: 'ESTH-L3',
        },
      ],
    },
    actorId
  );

  const reloadedV2 = await planService.getProtocol(protocolV2.id);
  const itemV2 = reloadedV2.items[0];
  assert(
    itemV2.parameters?.concentration === 40 && itemV2.parameters?.duration === 15,
    `v2 item parameters round-trip correctly (got ${JSON.stringify(itemV2.parameters)})`
  );
  assert(itemV2.patchTestRequired === false, `v2 item patchTestRequired round-trips as false (got ${itemV2.patchTestRequired})`);
  assert(itemV2.consentRequired === false, `v2 item consentRequired round-trips as false (got ${itemV2.consentRequired})`);
  assert(
    itemV2.requiredSkillCode === 'ESTH-L3',
    `v2 item requiredSkillCode round-trips correctly (got ${itemV2.requiredSkillCode})`
  );

  // 3. Sanity: defaults still apply when fields are omitted.
  const protocolV3 = await planService.createProtocol(
    {
      name: 'Basic Facial',
      category: 'Skin',
      estimatedSessions: 1,
      items: [{ procedureName: 'Cleanse' }],
    },
    actorId
  );
  const reloadedV3 = await planService.getProtocol(protocolV3.id);
  const itemV3 = reloadedV3.items[0];
  assert(itemV3.patchTestRequired === false, `default patchTestRequired is false (got ${itemV3.patchTestRequired})`);
  assert(itemV3.consentRequired === true, `default consentRequired is true (got ${itemV3.consentRequired})`);
  assert(itemV3.requiredSkillCode === null, `default requiredSkillCode is null (got ${itemV3.requiredSkillCode})`);
  assert(
    itemV3.parameters && Object.keys(itemV3.parameters).length === 0,
    `default parameters is an empty object (got ${JSON.stringify(itemV3.parameters)})`
  );

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch(async (err) => {
  console.error('SMOKE FAIL', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* noop */
  }
  process.exit(1);
});
