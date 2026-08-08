import Organization from '../models/Organization.model.js';
import { refreshOrgRuntime } from '../config/orgRuntime.js';

class OrganizationRepository {
  /**
   * Every load of the singleton refreshes the synchronous runtime mirror (timezone, financial
   * year start month) — see src/config/orgRuntime.js. OrganizationService.update() re-reads
   * through here after saving, so an edit is reflected immediately rather than at next restart.
   */
  async getSingleton() {
    let org = await Organization.findOne().exec();
    if (!org) {
      org = await Organization.create({
        legalName: 'Aurah 360',
        displayName: 'Aurah 360',
      });
    }
    refreshOrgRuntime(org);
    return org;
  }
}

export default OrganizationRepository;
