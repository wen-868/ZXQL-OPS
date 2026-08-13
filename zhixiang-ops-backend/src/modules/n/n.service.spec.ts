import 'dotenv/config';
import { RoleService } from './role.service';
import { AuditService } from './audit.service';
import { TenantContext } from '../../tenant/tenant-context';
import { RoleEntity } from './role.entity';
import { RoleUserEntity } from './role-user.entity';
import { AuditLogEntity } from './audit-log.entity';

/**
 * N 团队与权限 单元测试（规划「N 团队与权限」详细设计）。
 * RoleService / AuditService 直接实例化（不走 Nest DI），
 * 业务调用用 TenantContext.run 包裹，否则 requireTenantId 抛 TENANT_REQUIRED。
 */

// —— 链式 QueryBuilder mock（供 AuditService.query 使用）——
function buildQueryBuilder() {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
  };
}

function makeRole(partial: Partial<RoleEntity> & { id: number; tenantId: string }): RoleEntity {
  return {
    name: 'r',
    description: undefined,
    permissions: [],
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as RoleEntity;
}

describe('RoleService', () => {
  let svc: RoleService;
  let mockRoleRepo: any;
  let mockRoleUserRepo: any;
  let mockAudit: any;

  beforeEach(() => {
    mockAudit = { record: jest.fn().mockResolvedValue({}) };
    mockRoleUserRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((e: Partial<RoleUserEntity>) => e),
      save: jest.fn(async (e: RoleUserEntity) => e),
      softDelete: jest.fn().mockResolvedValue({}),
    };
    mockRoleRepo = {
      create: jest.fn((e: Partial<RoleEntity>) => e),
      save: jest.fn(async (e: RoleEntity) => e),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      softDelete: jest.fn().mockResolvedValue({}),
    };
    svc = new RoleService(mockRoleRepo, mockRoleUserRepo, mockAudit);
  });

  describe('create', () => {
    it('正常创建角色且落审计，入库对象带 tenantId', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(undefined); // 不重名
      const saved = makeRole({
        id: 1,
        tenantId: 'tn-1',
        name: '运营',
        permissions: ['account:read'],
      });
      mockRoleRepo.save.mockResolvedValueOnce(saved);

      const result = await TenantContext.run({ traceId: 't1', tenantId: 'tn-1' }, () =>
        svc.create({ name: '运营', permissions: ['account:read'] } as any),
      );

      const persisted = mockRoleRepo.save.mock.calls[0][0] as RoleEntity;
      expect(persisted.tenantId).toBe('tn-1');
      expect(persisted.name).toBe('运营');
      expect(persisted.isSystem).toBe(false);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create_role', module: 'role', resource: 'roleId:1' }),
      );
      expect(result.id).toBe(1);
    });

    it('同租户重名 → 抛 ROLE_DUPLICATE', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(
        makeRole({ id: 9, tenantId: 'tn-1', name: '运营' }),
      );
      await expect(
        TenantContext.run({ traceId: 't2', tenantId: 'tn-1' }, () =>
          svc.create({ name: '运营', permissions: [] } as any),
        ),
      ).rejects.toMatchObject({ code: 'ROLE_DUPLICATE' });
    });
  });

  describe('get / list', () => {
    it('get 不存在 → ROLE_NOT_FOUND', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 't3', tenantId: 'tn-1' }, () => svc.get(999)),
      ).rejects.toMatchObject({ code: 'ROLE_NOT_FOUND' });
    });

    it('list 返回标准分页结构', async () => {
      const rows = [makeRole({ id: 1, tenantId: 'tn-1', name: 'r1', permissions: ['a'] })];
      mockRoleRepo.findAndCount.mockResolvedValueOnce([rows, 7]);
      const result = await TenantContext.run({ traceId: 't4', tenantId: 'tn-1' }, () =>
        svc.list({ page: 2, pageSize: 10 }),
      );
      expect(result).toHaveProperty('list');
      expect(result.total).toBe(7);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.list[0].name).toBe('r1');
    });
  });

  describe('update', () => {
    it('局部更新生效并落审计', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(
        makeRole({ id: 1, tenantId: 'tn-1', name: '旧', permissions: [] }),
      );
      const saved = makeRole({
        id: 1,
        tenantId: 'tn-1',
        name: '新',
        permissions: ['account:write'],
      });
      mockRoleRepo.save.mockResolvedValueOnce(saved);

      const result = await TenantContext.run({ traceId: 't5', tenantId: 'tn-1' }, () =>
        svc.update(1, { name: '新', permissions: ['account:write'] } as any),
      );
      const persisted = mockRoleRepo.save.mock.calls[0][0] as RoleEntity;
      expect(persisted.name).toBe('新');
      expect(persisted.permissions).toEqual(['account:write']);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update_role', resource: 'roleId:1' }),
      );
      expect(result.name).toBe('新');
    });
  });

  describe('remove', () => {
    it('不存在 → ROLE_NOT_FOUND', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 't6', tenantId: 'tn-1' }, () => svc.remove(999)),
      ).rejects.toMatchObject({ code: 'ROLE_NOT_FOUND' });
    });

    it('系统内置角色 → ROLE_SYSTEM_PROTECTED', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(
        makeRole({ id: 1, tenantId: 'tn-1', isSystem: true }),
      );
      await expect(
        TenantContext.run({ traceId: 't7', tenantId: 'tn-1' }, () => svc.remove(1)),
      ).rejects.toMatchObject({ code: 'ROLE_SYSTEM_PROTECTED' });
      expect(mockRoleRepo.softDelete).not.toHaveBeenCalled();
    });

    it('普通角色 → 级联删绑定 + 软删角色 + 落审计', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(
        makeRole({ id: 5, tenantId: 'tn-1', isSystem: false }),
      );
      const result = await TenantContext.run({ traceId: 't8', tenantId: 'tn-1' }, () =>
        svc.remove(5),
      );
      expect(mockRoleUserRepo.softDelete).toHaveBeenCalledWith({ tenantId: 'tn-1', roleId: 5 });
      expect(mockRoleRepo.softDelete).toHaveBeenCalledWith({ id: 5, tenantId: 'tn-1' });
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete_role', resource: 'roleId:5' }),
      );
      expect(result).toEqual({ id: 5 });
    });
  });

  describe('assign / unassign', () => {
    it('assign 角色不存在 → ROLE_NOT_FOUND', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 't9', tenantId: 'tn-1' }, () => svc.assign(1, 100)),
      ).rejects.toMatchObject({ code: 'ROLE_NOT_FOUND' });
    });

    it('assign 重复绑定 → ROLE_ASSIGN_DUP', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(makeRole({ id: 1, tenantId: 'tn-1' }));
      mockRoleUserRepo.findOne = jest
        .fn()
        .mockResolvedValueOnce({ id: 1, tenantId: 'tn-1', userId: 100, roleId: 1 });
      await expect(
        TenantContext.run({ traceId: 't10', tenantId: 'tn-1' }, () => svc.assign(1, 100)),
      ).rejects.toMatchObject({ code: 'ROLE_ASSIGN_DUP' });
    });

    it('assign 正常绑定并落审计', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(makeRole({ id: 1, tenantId: 'tn-1' }));
      mockRoleUserRepo.findOne = jest.fn().mockResolvedValueOnce(undefined);
      const result = await TenantContext.run({ traceId: 't11', tenantId: 'tn-1' }, () =>
        svc.assign(1, 100),
      );
      const bound = mockRoleUserRepo.save.mock.calls[0][0] as RoleUserEntity;
      expect(bound.tenantId).toBe('tn-1');
      expect(bound.userId).toBe(100);
      expect(bound.roleId).toBe(1);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'assign_role', resource: 'roleId:1;userId:100' }),
      );
      expect(result).toEqual({ roleId: 1, userId: 100 });
    });

    it('unassign 绑定不存在 → ROLE_USER_NOT_FOUND', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(makeRole({ id: 1, tenantId: 'tn-1' }));
      mockRoleUserRepo.findOne = jest.fn().mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 't12', tenantId: 'tn-1' }, () => svc.unassign(1, 100)),
      ).rejects.toMatchObject({ code: 'ROLE_USER_NOT_FOUND' });
    });

    it('unassign 正常移除绑定并落审计', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(makeRole({ id: 1, tenantId: 'tn-1' }));
      mockRoleUserRepo.findOne = jest
        .fn()
        .mockResolvedValueOnce({ id: 1, tenantId: 'tn-1', userId: 100, roleId: 1 });
      const result = await TenantContext.run({ traceId: 't13', tenantId: 'tn-1' }, () =>
        svc.unassign(1, 100),
      );
      expect(mockRoleUserRepo.softDelete).toHaveBeenCalledWith({
        tenantId: 'tn-1',
        userId: 100,
        roleId: 1,
      });
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'unassign_role', resource: 'roleId:1;userId:100' }),
      );
      expect(result).toEqual({ roleId: 1, userId: 100 });
    });
  });

  describe('getUserRoles', () => {
    it('无绑定 → 返回空角色与空权限', async () => {
      mockRoleUserRepo.find.mockResolvedValueOnce([]);
      const result = await TenantContext.run({ traceId: 't14', tenantId: 'tn-1' }, () =>
        svc.getUserRoles(100),
      );
      expect(result.roles).toEqual([]);
      expect(result.permissions).toEqual([]);
    });

    it('有绑定 → 合并去重权限', async () => {
      mockRoleUserRepo.find.mockResolvedValueOnce([
        { tenantId: 'tn-1', userId: 100, roleId: 1 },
        { tenantId: 'tn-1', userId: 100, roleId: 2 },
      ] as RoleUserEntity[]);
      mockRoleRepo.find.mockResolvedValueOnce([
        makeRole({ id: 1, tenantId: 'tn-1', name: 'r1', permissions: ['a:read', 'b:write'] }),
        makeRole({ id: 2, tenantId: 'tn-1', name: 'r2', permissions: ['b:write', 'c:del'] }),
      ]);
      const result = await TenantContext.run({ traceId: 't15', tenantId: 'tn-1' }, () =>
        svc.getUserRoles(100),
      );
      expect(result.roles).toHaveLength(2);
      expect(result.permissions.sort()).toEqual(['a:read', 'b:write', 'c:del']);
    });
  });

  describe('跨租户隔离', () => {
    it('create 入库对象 tenantId 与上下文一致', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce(undefined);
      await TenantContext.run({ traceId: 't16', tenantId: 'tn-2' }, () =>
        svc.create({ name: 'x', permissions: [] } as any),
      );
      expect(mockRoleRepo.save.mock.calls[0][0].tenantId).toBe('tn-2');
      // 查重与落库都基于同一 tenantId
      expect(mockRoleRepo.findOne.mock.calls[0][0].where).toEqual({ tenantId: 'tn-2', name: 'x' });
    });
  });
});

describe('AuditService', () => {
  let svc: AuditService;
  let mockAuditRepo: any;
  let qb: ReturnType<typeof buildQueryBuilder>;

  beforeEach(() => {
    qb = buildQueryBuilder();
    mockAuditRepo = {
      create: jest.fn((e: Partial<AuditLogEntity>) => e),
      save: jest.fn(async (e: AuditLogEntity) => e),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    svc = new AuditService(mockAuditRepo);
  });

  it('record：写入 tenantId/userId/action/module/traceId，ts 为 Date', async () => {
    const result = await TenantContext.run({ traceId: 'tr-1', tenantId: 'tn-1', userId: 7 }, () =>
      svc.record({ action: 'create_role', module: 'role', resource: 'roleId:1' }),
    );
    const persisted = mockAuditRepo.save.mock.calls[0][0] as AuditLogEntity;
    expect(persisted.tenantId).toBe('tn-1');
    expect(persisted.userId).toBe(7); // 从上下文透传
    expect(persisted.action).toBe('create_role');
    expect(persisted.module).toBe('role');
    expect(persisted.resource).toBe('roleId:1');
    expect(persisted.traceId).toBe('tr-1');
    expect(persisted.ts).toBeInstanceOf(Date);
    expect(result).toBeDefined();
  });

  it('query：tenant 隔离 + 过滤 + ts 降序分页', async () => {
    const rows = [
      {
        id: 1,
        tenantId: 'tn-1',
        userId: 7,
        action: 'create_role',
        module: 'role',
        resource: 'r1',
        ts: new Date(),
      },
    ] as AuditLogEntity[];
    qb.getManyAndCount.mockResolvedValueOnce([rows, 1]);

    const result = await TenantContext.run({ traceId: 'tq1', tenantId: 'tn-1' }, () =>
      svc.query({ page: 1, pageSize: 20, module: 'role' }),
    );

    expect(qb.where).toHaveBeenCalledWith('a.tenant_id = :tenantId', { tenantId: 'tn-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('a.module = :module', { module: 'role' });
    expect(qb.orderBy).toHaveBeenCalledWith('a.ts', 'DESC');
    expect(result.total).toBe(1);
    expect(result.list[0].action).toBe('create_role');
  });

  it('record 在缺失 userId 的上下文中也成功（userId 可为空）', async () => {
    await TenantContext.run({ traceId: 'tr-2', tenantId: 'tn-1' }, () =>
      svc.record({ action: 'x', module: 'y' }),
    );
    const persisted = mockAuditRepo.save.mock.calls[0][0] as AuditLogEntity;
    expect(persisted.userId).toBeUndefined();
    expect(persisted.tenantId).toBe('tn-1');
  });
});
