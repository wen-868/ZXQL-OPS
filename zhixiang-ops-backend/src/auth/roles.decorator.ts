import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * 角色限定装饰器：标注接口所需的最低角色（admin / editor / viewer）。
 * 配合全局 RolesGuard 使用；未标注的接口仅需登录。
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
