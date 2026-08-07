/**
 * Module 9 seed — 100 medicines, sample prescriptions, favorite templates.
 */
import Medicine from '../models/Medicine.model.js';
import Prescription from '../models/Prescription.model.js';
import PrescriptionTemplate from '../models/PrescriptionTemplate.model.js';
import Consultation from '../models/Consultation.model.js';
import Doctor from '../models/Doctor.model.js';
import {
  generateMedicineCode,
  generatePrescriptionNumber,
} from '../helpers/prescriptionNumber.helper.js';
import {
  DOSAGE_FORM,
  MEDICINE_ROUTE,
  PRESCRIPTION_STATUS,
} from '../enums/prescription.js';
import { ENTITY_STATUS } from '../constants/index.js';
import logger from '../libs/logger.js';

const CATEGORIES = [
  'Antibiotic',
  'Antifungal',
  'Antihistamine',
  'Steroid',
  'Retinoid',
  'Hair Care',
  'Pigmentation',
  'Moisturizer',
  'Sunscreen',
  'Supplement',
];

const BASE_MEDS = [
  ['Minoxidil', 'Minoxidil', '5%', DOSAGE_FORM.LOTION, MEDICINE_ROUTE.TOPICAL, 'Hair Care'],
  ['Finasteride', 'Finasteride', '1mg', DOSAGE_FORM.TABLET, MEDICINE_ROUTE.ORAL, 'Hair Care'],
  ['Isotretinoin', 'Isotretinoin', '20mg', DOSAGE_FORM.CAPSULE, MEDICINE_ROUTE.ORAL, 'Retinoid'],
  ['Tretinoin Cream', 'Tretinoin', '0.025%', DOSAGE_FORM.CREAM, MEDICINE_ROUTE.TOPICAL, 'Retinoid'],
  ['Clindamycin Gel', 'Clindamycin', '1%', DOSAGE_FORM.GEL, MEDICINE_ROUTE.TOPICAL, 'Antibiotic'],
  ['Benzoyl Peroxide', 'Benzoyl peroxide', '2.5%', DOSAGE_FORM.GEL, MEDICINE_ROUTE.TOPICAL, 'Antibiotic'],
  ['Hydroquinone', 'Hydroquinone', '2%', DOSAGE_FORM.CREAM, MEDICINE_ROUTE.TOPICAL, 'Pigmentation'],
  ['Kojic Acid Cream', 'Kojic acid', '2%', DOSAGE_FORM.CREAM, MEDICINE_ROUTE.TOPICAL, 'Pigmentation'],
  ['Mometasone', 'Mometasone', '0.1%', DOSAGE_FORM.CREAM, MEDICINE_ROUTE.TOPICAL, 'Steroid'],
  ['Cetirizine', 'Cetirizine', '10mg', DOSAGE_FORM.TABLET, MEDICINE_ROUTE.ORAL, 'Antihistamine'],
  ['Levocetirizine', 'Levocetirizine', '5mg', DOSAGE_FORM.TABLET, MEDICINE_ROUTE.ORAL, 'Antihistamine'],
  ['Itraconazole', 'Itraconazole', '100mg', DOSAGE_FORM.CAPSULE, MEDICINE_ROUTE.ORAL, 'Antifungal'],
  ['Terbinafine', 'Terbinafine', '250mg', DOSAGE_FORM.TABLET, MEDICINE_ROUTE.ORAL, 'Antifungal'],
  ['Ketoconazole Shampoo', 'Ketoconazole', '2%', DOSAGE_FORM.LOTION, MEDICINE_ROUTE.TOPICAL, 'Antifungal'],
  ['Vitamin C Serum', 'Ascorbic acid', '15%', DOSAGE_FORM.GEL, MEDICINE_ROUTE.TOPICAL, 'Pigmentation'],
  ['SPF 50 Sunscreen', 'Zinc oxide', 'SPF50', DOSAGE_FORM.CREAM, MEDICINE_ROUTE.TOPICAL, 'Sunscreen'],
  ['Biotin', 'Biotin', '5mg', DOSAGE_FORM.TABLET, MEDICINE_ROUTE.ORAL, 'Supplement'],
  ['Multivitamin', 'Multivitamins', 'OD', DOSAGE_FORM.TABLET, MEDICINE_ROUTE.ORAL, 'Supplement'],
  ['Azelaic Acid', 'Azelaic acid', '10%', DOSAGE_FORM.CREAM, MEDICINE_ROUTE.TOPICAL, 'Pigmentation'],
  ['Salicylic Acid', 'Salicylic acid', '2%', DOSAGE_FORM.GEL, MEDICINE_ROUTE.TOPICAL, 'Antibiotic'],
];

export async function seedModule9() {
  const existingMeds = await Medicine.countDocuments({ deletedAt: null });
  if (existingMeds < 100) {
    const toCreate = [];
    for (let i = 0; i < 100; i += 1) {
      const base = BASE_MEDS[i % BASE_MEDS.length];
      const [name, generic, strength, form, route, category] = base;
      const suffix = i < BASE_MEDS.length ? '' : ` ${Math.floor(i / BASE_MEDS.length) + 1}`;
      toCreate.push({
        medicineCode: await generateMedicineCode(),
        name: `${name}${suffix}`,
        genericName: generic,
        brand: `Aurah ${name.split(' ')[0]}`,
        category: category || CATEGORIES[i % CATEGORIES.length],
        strength,
        dosageForm: form,
        defaultRoute: route,
        manufacturer: i % 2 === 0 ? 'Sun Pharma' : 'Cipla',
        mrp: 50 + (i % 40) * 10,
        status: ENTITY_STATUS.ACTIVE,
        isActive: true,
      });
    }
    await Medicine.insertMany(toCreate);
    logger.info('Module 9 medicines seeded', { created: toCreate.length });
  } else {
    logger.info('Module 9 medicines already seeded', { existingMeds });
  }

  const medicines = await Medicine.find({ deletedAt: null, isActive: true }).limit(30).exec();
  const consultations = await Consultation.find({ deletedAt: null }).limit(10).exec();
  const doctors = await Doctor.find({ deletedAt: null, isActive: true }).limit(2).exec();

  if (!consultations.length || !medicines.length || !doctors.length) {
    logger.warn('Module 9 prescriptions seed skipped — missing consultations/medicines/doctors');
    return;
  }

  const existingRx = await Prescription.countDocuments({ deletedAt: null });
  if (existingRx < 5) {
    for (let i = 0; i < Math.min(5, consultations.length); i += 1) {
      const c = consultations[i];
      const m1 = medicines[i % medicines.length];
      const m2 = medicines[(i + 3) % medicines.length];
      await Prescription.create({
        prescriptionNumber: await generatePrescriptionNumber(),
        consultationId: c._id,
        patientId: c.patientId,
        doctorId: c.doctorId,
        branchId: c.branchId,
        status: i < 3 ? PRESCRIPTION_STATUS.FINALIZED : PRESCRIPTION_STATUS.DRAFT,
        notes: 'Seed prescription',
        items: [
          {
            medicineId: m1._id,
            medicineName: m1.name,
            genericName: m1.genericName,
            strength: m1.strength,
            dosage: '1 application',
            frequency: 'Twice daily',
            duration: '4 weeks',
            route: m1.defaultRoute || MEDICINE_ROUTE.TOPICAL,
            morning: true,
            night: true,
            afterFood: false,
            beforeFood: false,
            quantity: 1,
          },
          {
            medicineId: m2._id,
            medicineName: m2.name,
            genericName: m2.genericName,
            strength: m2.strength,
            dosage: '1 tablet',
            frequency: 'Once daily',
            duration: '30 days',
            route: m2.defaultRoute || MEDICINE_ROUTE.ORAL,
            morning: true,
            afterFood: true,
            quantity: 30,
          },
        ],
        finalizedAt: i < 3 ? new Date() : null,
      });
    }
    logger.info('Module 9 sample prescriptions seeded');
  }

  const doctor = doctors[0];
  const tplCount = await PrescriptionTemplate.countDocuments({
    doctorId: doctor._id,
    deletedAt: null,
  });
  if (tplCount === 0) {
    const fav = medicines.slice(0, 5);
    await PrescriptionTemplate.create([
      {
        doctorId: doctor._id,
        name: 'Acne starter pack',
        isFavorite: true,
        items: fav.slice(0, 3).map((m) => ({
          medicineId: m._id,
          medicineName: m.name,
          genericName: m.genericName,
          strength: m.strength,
          dosage: 'As directed',
          frequency: 'Twice daily',
          duration: '4 weeks',
          route: m.defaultRoute || 'TOPICAL',
          night: true,
        })),
        notes: 'Favorite acne template',
      },
      {
        doctorId: doctor._id,
        name: fav[0].name,
        isFavorite: true,
        medicineId: fav[0]._id,
        items: [],
      },
      {
        doctorId: doctor._id,
        name: 'Hair loss protocol',
        isFavorite: true,
        items: fav.slice(3, 5).map((m) => ({
          medicineId: m._id,
          medicineName: m.name,
          genericName: m.genericName,
          strength: m.strength,
          dosage: '1',
          frequency: 'Once daily',
          duration: '3 months',
          route: m.defaultRoute || 'ORAL',
          morning: true,
        })),
      },
    ]);
    logger.info('Module 9 prescription templates seeded');
  }
}

export default seedModule9;
