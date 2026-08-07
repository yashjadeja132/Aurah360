import RoleRepository from '../repositories/RoleRepository.js';
import { resolveEffectivePermissions } from '../helpers/permission.helper.js';
import ApiError from '../libs/ApiError.js';

class RoleService {
  constructor() {
    this.roleRepository = new RoleRepository();
  }

  async listRoles() {
    const roles = await this.roleRepository.findAllActive();
    return roles.map((r) => r.toSafeObject());
  }

  async getByCode(code) {
    const role = await this.roleRepository.findByCode(code);
    if (!role) {
      throw ApiError.notFound('Role not found');
    }
    return role;
  }

  async getEffectivePermissions(roleCode, overrides = []) {
    const role = await this.getByCode(roleCode);
    return resolveEffectivePermissions(role.permissions, overrides);
  }
}

export default RoleService;
