import Organization from '../models/Organization.model.js';

class OrganizationRepository {
  async getSingleton() {
    let org = await Organization.findOne().exec();
    if (!org) {
      org = await Organization.create({
        legalName: 'Aurah 360',
        displayName: 'Aurah 360',
      });
    }
    return org;
  }
}

export default OrganizationRepository;
