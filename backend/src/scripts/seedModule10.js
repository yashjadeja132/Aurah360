/**
 * Module 10 seed — 20 protocols, 10 packages, sample treatment plans.
 * Planning only — no sessions, billing, or inventory.
 */
import TreatmentProtocol from '../models/TreatmentProtocol.model.js';
import TreatmentPackage from '../models/TreatmentPackage.model.js';
import TreatmentPlan from '../models/TreatmentPlan.model.js';
import ConsentRecord from '../models/ConsentRecord.model.js';
import Consultation from '../models/Consultation.model.js';
import {
  generateTreatmentPlanNumber,
  generateProtocolCode,
  generatePackageCode,
} from '../helpers/treatmentPlanNumber.helper.js';
import {
  CONSENT_STATUS,
  CONSENT_TYPE,
  CONSENT_TYPE_LIST,
  TREATMENT_PLAN_PRIORITY,
  TREATMENT_PLAN_STATUS,
} from '../enums/treatmentPlan.js';
import logger from '../libs/logger.js';

const PROTOCOL_DEFS = [
  {
    name: 'PRP Hair',
    category: 'Hair',
    clinicalGoal: 'Stimulate hair growth via platelet-rich plasma',
    estimatedDuration: '6 months',
    estimatedSessions: 6,
    defaultConsents: [CONSENT_TYPE.TREATMENT, CONSENT_TYPE.PROCEDURE, CONSENT_TYPE.PHOTOGRAPHY],
    items: [
      {
        procedureName: 'PRP Injection — Scalp',
        sessionCount: 6,
        sessionDuration: 45,
        frequency: 'Every 4 weeks',
        deviceRequired: 'PRP centrifuge',
        roomRequired: 'Procedure room',
        technicianRequired: true,
        consumables: ['PRP kit', 'Needles', 'Antiseptic'],
        preInstructions: 'Avoid NSAIDs 48h prior; wash hair morning of session',
        postInstructions: 'No wash for 12h; avoid sun/heat 24h',
      },
    ],
  },
  {
    name: 'Hydra Facial',
    category: 'Facial',
    clinicalGoal: 'Deep cleanse, extract, hydrate',
    estimatedDuration: '4–6 weeks',
    estimatedSessions: 4,
    defaultConsents: [CONSENT_TYPE.TREATMENT, CONSENT_TYPE.PHOTOGRAPHY],
    items: [
      {
        procedureName: 'HydraFacial MD',
        sessionCount: 4,
        sessionDuration: 45,
        frequency: 'Every 2–3 weeks',
        deviceRequired: 'HydraFacial device',
        roomRequired: 'Facial room',
        technicianRequired: true,
        consumables: ['Tips', 'Serums', 'Booster'],
        preInstructions: 'No retinoids 48h prior',
        postInstructions: 'SPF mandatory; avoid peels 1 week',
      },
    ],
  },
  {
    name: 'Laser Hair Removal',
    category: 'Laser',
    clinicalGoal: 'Permanent hair reduction',
    estimatedDuration: '8–12 months',
    estimatedSessions: 8,
    defaultConsents: [CONSENT_TYPE.LASER, CONSENT_TYPE.TREATMENT, CONSENT_TYPE.PHOTOGRAPHY],
    items: [
      {
        procedureName: 'Diode Laser Hair Reduction',
        sessionCount: 8,
        sessionDuration: 30,
        frequency: 'Every 6–8 weeks',
        deviceRequired: 'Diode laser',
        roomRequired: 'Laser room',
        technicianRequired: true,
        consumables: ['Gel', 'Cooling tips', 'Eye shields'],
        preInstructions: 'Shave 24h prior; no sun exposure 2 weeks',
        postInstructions: 'Cool compress; SPF; avoid heat 48h',
      },
    ],
  },
  {
    name: 'Carbon Peel',
    category: 'Laser',
    clinicalGoal: 'Oil control, pore refinement, glow',
    estimatedDuration: '4–6 weeks',
    estimatedSessions: 4,
    defaultConsents: [CONSENT_TYPE.LASER, CONSENT_TYPE.TREATMENT],
    items: [
      {
        procedureName: 'Carbon Laser Peel',
        sessionCount: 4,
        sessionDuration: 30,
        frequency: 'Every 2 weeks',
        deviceRequired: 'Q-switched Nd:YAG',
        roomRequired: 'Laser room',
        technicianRequired: true,
        consumables: ['Carbon lotion', 'Eye shields'],
        preInstructions: 'Clean face; no makeup',
        postInstructions: 'Mild redness expected; moisturizer + SPF',
      },
    ],
  },
  {
    name: 'Microneedling',
    category: 'Skin',
    clinicalGoal: 'Collagen induction for scars/texture',
    estimatedDuration: '3–4 months',
    estimatedSessions: 4,
    defaultConsents: [CONSENT_TYPE.PROCEDURE, CONSENT_TYPE.TREATMENT, CONSENT_TYPE.PHOTOGRAPHY],
    items: [
      {
        procedureName: 'Microneedling with Growth Factors',
        sessionCount: 4,
        sessionDuration: 60,
        frequency: 'Every 4 weeks',
        deviceRequired: 'Dermapen / RF microneedling',
        roomRequired: 'Procedure room',
        technicianRequired: true,
        consumables: ['Cartridges', 'Numbing cream', 'Serum'],
        preInstructions: 'Stop retinoids 5 days prior',
        postInstructions: 'No makeup 24h; healing cream; SPF',
      },
    ],
  },
  {
    name: 'Chemical Peel',
    category: 'Peel',
    clinicalGoal: 'Pigmentation and texture improvement',
    estimatedDuration: '6–8 weeks',
    estimatedSessions: 4,
    defaultConsents: [CONSENT_TYPE.PROCEDURE, CONSENT_TYPE.TREATMENT],
    items: [
      {
        procedureName: 'Medium-depth Chemical Peel',
        sessionCount: 4,
        sessionDuration: 40,
        frequency: 'Every 3–4 weeks',
        deviceRequired: null,
        roomRequired: 'Procedure room',
        technicianRequired: true,
        consumables: ['Peel solution', 'Neutralizer', 'Cooling gel'],
        preInstructions: 'Prime skin 2 weeks; no waxing 1 week',
        postInstructions: 'Peeling expected; strict SPF; no picking',
      },
    ],
  },
  {
    name: 'Acne Clearance Protocol',
    category: 'Skin',
    clinicalGoal: 'Reduce active acne and prevent scarring',
    estimatedDuration: '3 months',
    estimatedSessions: 6,
    items: [
      {
        procedureName: 'Acne Facial + Blue Light',
        sessionCount: 6,
        sessionDuration: 45,
        frequency: 'Every 2 weeks',
        deviceRequired: 'LED blue light',
        roomRequired: 'Facial room',
        technicianRequired: true,
        consumables: ['Acne serum', 'Extraction tools'],
        preInstructions: 'No active breakouts from scrubbing',
        postInstructions: 'Non-comedogenic moisturizer',
      },
    ],
  },
  {
    name: 'Pigmentation Correction',
    category: 'Skin',
    clinicalGoal: 'Fade melasma / PIH',
    estimatedDuration: '4 months',
    estimatedSessions: 5,
    items: [
      {
        procedureName: 'Pigment Laser + Topical Plan',
        sessionCount: 5,
        sessionDuration: 30,
        frequency: 'Every 3–4 weeks',
        deviceRequired: 'Picosecond / Q-switched laser',
        roomRequired: 'Laser room',
        technicianRequired: true,
        consumables: ['Cooling gel', 'Eye shields'],
        preInstructions: 'Strict sun avoidance 2 weeks',
        postInstructions: 'Hydroquinone pause per doctor; SPF 50+',
      },
    ],
  },
  {
    name: 'Anti-Aging Facial Series',
    category: 'Facial',
    clinicalGoal: 'Improve firmness and radiance',
    estimatedDuration: '3 months',
    estimatedSessions: 6,
    items: [
      {
        procedureName: 'Anti-Aging Facial with RF',
        sessionCount: 6,
        sessionDuration: 50,
        frequency: 'Every 2 weeks',
        deviceRequired: 'RF device',
        roomRequired: 'Facial room',
        technicianRequired: true,
        consumables: ['RF gel', 'Peptide serum'],
        preInstructions: 'Remove jewelry; clean skin',
        postInstructions: 'Hydrate well; SPF',
      },
    ],
  },
  {
    name: 'Under-Eye Rejuvenation',
    category: 'Injectables',
    clinicalGoal: 'Improve dark circles and hollowness',
    estimatedDuration: '2–3 months',
    estimatedSessions: 3,
    items: [
      {
        procedureName: 'Under-Eye Mesotherapy',
        sessionCount: 3,
        sessionDuration: 30,
        frequency: 'Every 4 weeks',
        deviceRequired: null,
        roomRequired: 'Injection room',
        technicianRequired: false,
        consumables: ['Meso cocktail', 'Needles'],
        preInstructions: 'Avoid blood thinners if advised',
        postInstructions: 'Ice; no rubbing 24h',
      },
    ],
  },
  {
    name: 'Body Contouring — Abdomen',
    category: 'Body',
    clinicalGoal: 'Reduce localized fat / firm skin',
    estimatedDuration: '2 months',
    estimatedSessions: 6,
    items: [
      {
        procedureName: 'Cryolipolysis / HIFU Abdomen',
        sessionCount: 6,
        sessionDuration: 60,
        frequency: 'Weekly',
        deviceRequired: 'HIFU / CoolSculpting',
        roomRequired: 'Body room',
        technicianRequired: true,
        consumables: ['Coupling gel', 'Applicator pads'],
        preInstructions: 'Stay hydrated; light meal',
        postInstructions: 'Massage area; maintain diet',
      },
    ],
  },
  {
    name: 'Scar Revision Protocol',
    category: 'Skin',
    clinicalGoal: 'Improve atrophic / acne scars',
    estimatedDuration: '6 months',
    estimatedSessions: 5,
    items: [
      {
        procedureName: 'Fractional Laser Scar Revision',
        sessionCount: 5,
        sessionDuration: 45,
        frequency: 'Every 6 weeks',
        deviceRequired: 'Fractional CO2 / Erbium',
        roomRequired: 'Laser room',
        technicianRequired: true,
        consumables: ['Numbing cream', 'Dressings'],
        preInstructions: 'Antiviral prophylaxis if history of HSV',
        postInstructions: 'Wound care; strict sun avoidance',
      },
    ],
  },
  {
    name: 'Rosacea Calm Protocol',
    category: 'Skin',
    clinicalGoal: 'Reduce redness and flares',
    estimatedDuration: '3 months',
    estimatedSessions: 4,
    items: [
      {
        procedureName: 'Vascular Laser + Barrier Repair',
        sessionCount: 4,
        sessionDuration: 30,
        frequency: 'Every 4 weeks',
        deviceRequired: 'Pulsed dye / Nd:YAG',
        roomRequired: 'Laser room',
        technicianRequired: true,
        consumables: ['Cooling gel'],
        preInstructions: 'Avoid triggers (heat, alcohol) 48h',
        postInstructions: 'Gentle skincare; mineral SPF',
      },
    ],
  },
  {
    name: 'Stretch Mark Reduction',
    category: 'Body',
    clinicalGoal: 'Improve appearance of striae',
    estimatedDuration: '4 months',
    estimatedSessions: 6,
    items: [
      {
        procedureName: 'Microneedling RF for Striae',
        sessionCount: 6,
        sessionDuration: 50,
        frequency: 'Every 3 weeks',
        deviceRequired: 'RF microneedling',
        roomRequired: 'Body room',
        technicianRequired: true,
        consumables: ['Cartridges', 'Numbing cream'],
        preInstructions: 'Shave area if needed',
        postInstructions: 'Moisturize; avoid sun',
      },
    ],
  },
  {
    name: 'Tattoo Removal Series',
    category: 'Laser',
    clinicalGoal: 'Progressive ink clearance',
    estimatedDuration: '12+ months',
    estimatedSessions: 8,
    defaultConsents: [CONSENT_TYPE.LASER, CONSENT_TYPE.PROCEDURE, CONSENT_TYPE.PHOTOGRAPHY],
    items: [
      {
        procedureName: 'Q-switched / Pico Tattoo Removal',
        sessionCount: 8,
        sessionDuration: 30,
        frequency: 'Every 8 weeks',
        deviceRequired: 'Picosecond laser',
        roomRequired: 'Laser room',
        technicianRequired: true,
        consumables: ['Eye shields', 'Cooling'],
        preInstructions: 'No tan; intact skin',
        postInstructions: 'Blister care if needed; SPF',
      },
    ],
  },
  {
    name: 'IV Glow Drip Package Plan',
    category: 'Other',
    clinicalGoal: 'Support skin radiance (adjunct)',
    estimatedDuration: '1 month',
    estimatedSessions: 4,
    items: [
      {
        procedureName: 'IV Nutrient Infusion',
        sessionCount: 4,
        sessionDuration: 60,
        frequency: 'Weekly',
        deviceRequired: 'IV stand',
        roomRequired: 'Infusion bay',
        technicianRequired: true,
        consumables: ['IV set', 'Vitamins'],
        preInstructions: 'Eat light meal; hydrate',
        postInstructions: 'Rest 15 min; hydrate',
      },
    ],
  },
  {
    name: 'Beard / Neck Laser',
    category: 'Laser',
    clinicalGoal: 'Hair reduction neck/beard line',
    estimatedDuration: '6–8 months',
    estimatedSessions: 6,
    defaultConsents: [CONSENT_TYPE.LASER, CONSENT_TYPE.TREATMENT],
    items: [
      {
        procedureName: 'Laser Hair Reduction — Neck/Beard',
        sessionCount: 6,
        sessionDuration: 20,
        frequency: 'Every 6 weeks',
        deviceRequired: 'Diode laser',
        roomRequired: 'Laser room',
        technicianRequired: true,
        consumables: ['Gel', 'Eye shields'],
        preInstructions: 'Shave day prior',
        postInstructions: 'Cool compress; SPF',
      },
    ],
  },
  {
    name: 'Hand Rejuvenation',
    category: 'Skin',
    clinicalGoal: 'Improve hand skin quality',
    estimatedDuration: '3 months',
    estimatedSessions: 3,
    items: [
      {
        procedureName: 'Hand Peel + Filler Planning (plan only)',
        sessionCount: 3,
        sessionDuration: 40,
        frequency: 'Every 4 weeks',
        deviceRequired: null,
        roomRequired: 'Procedure room',
        technicianRequired: true,
        consumables: ['Peel', 'Gloves'],
        preInstructions: 'No manicure 48h prior',
        postInstructions: 'Moisturize; gloves if dishwashing',
      },
    ],
  },
  {
    name: 'Keratosis / Wart Protocol',
    category: 'Procedure',
    clinicalGoal: 'Clear benign lesions',
    estimatedDuration: '4–6 weeks',
    estimatedSessions: 2,
    items: [
      {
        procedureName: 'Cryotherapy / Electrocautery',
        sessionCount: 2,
        sessionDuration: 20,
        frequency: 'As needed',
        deviceRequired: 'Cryo / cautery unit',
        roomRequired: 'Minor OT',
        technicianRequired: false,
        consumables: ['Cryogen', 'Dressings'],
        preInstructions: 'Disclose pacemaker / metal implants',
        postInstructions: 'Keep clean; blister care',
      },
    ],
  },
  {
    name: 'Maintenance Glow Protocol',
    category: 'Facial',
    clinicalGoal: 'Maintain results after primary series',
    estimatedDuration: 'Ongoing',
    estimatedSessions: 4,
    items: [
      {
        procedureName: 'Maintenance Facial',
        sessionCount: 4,
        sessionDuration: 45,
        frequency: 'Monthly',
        deviceRequired: 'HydraFacial or LED',
        roomRequired: 'Facial room',
        technicianRequired: true,
        consumables: ['Serums', 'Masks'],
        preInstructions: 'Continue home care',
        postInstructions: 'SPF daily',
      },
    ],
  },
].map((p) => ({
  ...p,
  defaultConsents: p.defaultConsents || [
    CONSENT_TYPE.TREATMENT,
    CONSENT_TYPE.PROCEDURE,
    CONSENT_TYPE.PHOTOGRAPHY,
  ],
}));

// Fix category enum for Keratosis — Procedure isn't in TREATMENT_CATEGORIES
PROTOCOL_DEFS[18].category = 'Other';

const PACKAGE_DEFS = [
  { name: 'PRP Hair — 6 Session Pack', category: 'Hair', packagePrice: 45000, discount: 5000, maximumSessions: 6, validityDays: 180, protocolName: 'PRP Hair' },
  { name: 'Hydra Facial — 4 Pack', category: 'Facial', packagePrice: 18000, discount: 2000, maximumSessions: 4, validityDays: 90, protocolName: 'Hydra Facial' },
  { name: 'Laser Hair Full Legs — 8 Pack', category: 'Laser', packagePrice: 35000, discount: 4000, maximumSessions: 8, validityDays: 365, protocolName: 'Laser Hair Removal' },
  { name: 'Carbon Peel — 4 Pack', category: 'Laser', packagePrice: 12000, discount: 1500, maximumSessions: 4, validityDays: 90, protocolName: 'Carbon Peel' },
  { name: 'Microneedling — 4 Pack', category: 'Skin', packagePrice: 28000, discount: 3000, maximumSessions: 4, validityDays: 120, protocolName: 'Microneedling' },
  { name: 'Chemical Peel — 4 Pack', category: 'Peel', packagePrice: 16000, discount: 2000, maximumSessions: 4, validityDays: 120, protocolName: 'Chemical Peel' },
  { name: 'Acne Clearance — 6 Pack', category: 'Skin', packagePrice: 22000, discount: 2500, maximumSessions: 6, validityDays: 120, protocolName: 'Acne Clearance Protocol' },
  { name: 'Pigmentation — 5 Pack', category: 'Skin', packagePrice: 30000, discount: 3500, maximumSessions: 5, validityDays: 150, protocolName: 'Pigmentation Correction' },
  { name: 'Anti-Aging Facial — 6 Pack', category: 'Facial', packagePrice: 24000, discount: 3000, maximumSessions: 6, validityDays: 120, protocolName: 'Anti-Aging Facial Series' },
  { name: 'Body Contouring — 6 Pack', category: 'Body', packagePrice: 55000, discount: 5000, maximumSessions: 6, validityDays: 90, protocolName: 'Body Contouring — Abdomen' },
];

export async function seedModule10() {
  const existingProtocols = await TreatmentProtocol.countDocuments({ deletedAt: null });
  if (existingProtocols < 20) {
    const toCreate = [];
    for (const def of PROTOCOL_DEFS) {
      const exists = await TreatmentProtocol.findOne({ name: def.name, deletedAt: null }).exec();
      if (exists) continue;
      toCreate.push({
        protocolCode: await generateProtocolCode(),
        name: def.name,
        category: def.category,
        description: `${def.name} predefined protocol`,
        clinicalGoal: def.clinicalGoal,
        estimatedDuration: def.estimatedDuration,
        estimatedSessions: def.estimatedSessions,
        items: def.items,
        defaultConsents: def.defaultConsents,
        isActive: true,
      });
    }
    if (toCreate.length) {
      await TreatmentProtocol.insertMany(toCreate);
      logger.info('Module 10 protocols seeded', { created: toCreate.length });
    }
  } else {
    logger.info('Module 10 protocols already seeded', { existingProtocols });
  }

  const protocols = await TreatmentProtocol.find({ deletedAt: null, isActive: true }).exec();
  const byName = Object.fromEntries(protocols.map((p) => [p.name, p]));

  const existingPackages = await TreatmentPackage.countDocuments({ deletedAt: null });
  if (existingPackages < 10) {
    const toCreate = [];
    for (const def of PACKAGE_DEFS) {
      const exists = await TreatmentPackage.findOne({ name: def.name, deletedAt: null }).exec();
      if (exists) continue;
      const protocol = byName[def.protocolName];
      toCreate.push({
        packageCode: await generatePackageCode(),
        name: def.name,
        category: def.category,
        description: def.name,
        packagePrice: def.packagePrice,
        discount: def.discount,
        validityDays: def.validityDays,
        maximumSessions: def.maximumSessions,
        protocolId: protocol?._id || null,
        isActive: true,
      });
    }
    if (toCreate.length) {
      await TreatmentPackage.insertMany(toCreate);
      logger.info('Module 10 packages seeded', { created: toCreate.length });
    }
  } else {
    logger.info('Module 10 packages already seeded', { existingPackages });
  }

  const consultations = await Consultation.find({ deletedAt: null }).limit(5).exec();
  const packages = await TreatmentPackage.find({ deletedAt: null, isActive: true }).limit(5).exec();

  if (!consultations.length || !protocols.length) {
    logger.warn('Module 10 sample plans skipped — missing consultations/protocols');
    return;
  }

  const existingPlans = await TreatmentPlan.countDocuments({ deletedAt: null });
  if (existingPlans < 3) {
    for (let i = 0; i < Math.min(3, consultations.length); i += 1) {
      const c = consultations[i];
      const protocol = protocols[i % protocols.length];
      const pkg = packages[i % packages.length];
      const status =
        i === 0
          ? TREATMENT_PLAN_STATUS.DRAFT
          : i === 1
            ? TREATMENT_PLAN_STATUS.APPROVED
            : TREATMENT_PLAN_STATUS.RECOMMENDED;

      const plan = await TreatmentPlan.create({
        planNumber: await generateTreatmentPlanNumber(),
        consultationId: c._id,
        patientId: c.patientId,
        doctorId: c.doctorId,
        branchId: c.branchId,
        title: `${protocol.name} Plan`,
        description: 'Seed treatment plan — planning only',
        category: protocol.category,
        clinicalGoal: protocol.clinicalGoal,
        estimatedDuration: protocol.estimatedDuration,
        estimatedSessions: protocol.estimatedSessions,
        status,
        priority: TREATMENT_PLAN_PRIORITY.NORMAL,
        diagnosisSummary: 'Seed diagnosis summary',
        protocolId: protocol._id,
        items: (protocol.items || []).map((item) => ({
          procedureName: item.procedureName,
          sessionCount: item.sessionCount,
          sessionDuration: item.sessionDuration,
          frequency: item.frequency,
          deviceRequired: item.deviceRequired,
          roomRequired: item.roomRequired,
          technicianRequired: item.technicianRequired,
          consumables: item.consumables,
          preInstructions: item.preInstructions,
          postInstructions: item.postInstructions,
          protocolId: protocol._id,
        })),
        packageSnapshot: pkg
          ? {
              packageId: pkg._id,
              packageName: pkg.name,
              packagePrice: pkg.packagePrice,
              discount: pkg.discount,
              validityDays: pkg.validityDays,
              maximumSessions: pkg.maximumSessions,
              unusedSessions: pkg.maximumSessions,
            }
          : null,
        goals: {
          expectedResults: 'Visible improvement per protocol goals',
          clinicalObjectives: protocol.clinicalGoal,
          beforePhotosReference: 'Clinical photos from consultation',
          reviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        followUp: {
          reviewAfterDays: 30,
          reviewAfterSession: 2,
        },
        approvedAt: status === TREATMENT_PLAN_STATUS.APPROVED ? new Date() : null,
        recommendedAt: status !== TREATMENT_PLAN_STATUS.DRAFT ? new Date() : null,
      });

      for (const type of protocol.defaultConsents?.length
        ? protocol.defaultConsents
        : CONSENT_TYPE_LIST) {
        await ConsentRecord.create({
          treatmentPlanId: plan._id,
          patientId: plan.patientId,
          consentType: type,
          status: i === 1 ? CONSENT_STATUS.ACCEPTED : CONSENT_STATUS.PENDING,
          title: `${type} Consent`,
          body: `Seed consent for ${type}`,
          signedAt: i === 1 ? new Date() : null,
          signedByName: i === 1 ? 'Seed Patient' : null,
          signatureData: i === 1 ? 'E_SIGN_PLACEHOLDER' : null,
        });
      }
    }
    logger.info('Module 10 sample treatment plans seeded');
  } else {
    logger.info('Module 10 sample plans already present', { existingPlans });
  }
}

export default seedModule10;
