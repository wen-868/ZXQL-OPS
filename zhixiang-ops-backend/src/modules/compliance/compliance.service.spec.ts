import { ComplianceService } from './compliance.service';
import { ComplianceWordEntity } from './compliance-word.entity';
import { ComplianceLogEntity } from './compliance-log.entity';
import { AddComplianceWordDto } from './dto/add-word.dto';
import { TenantContext } from '../../tenant/tenant-context';

/** 链式 QueryBuilder mock（listWords/getLogs 复用） */
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

const TENANT = 'tn-1';

describe('ComplianceService（P 合规预检）', () => {
  let svc: ComplianceService;
  let mockWordRepo: any;
  let mockLogRepo: any;
  let qb: ReturnType<typeof buildQueryBuilder>;

  beforeEach(() => {
    qb = buildQueryBuilder();
    mockWordRepo = {
      find: jest.fn().mockResolvedValue([]), // 每次 ensureWords 视为空 → lazy seed
      findOne: jest.fn(),
      create: jest.fn((e: any) => ({ ...e })),
      save: jest.fn(async (e: any) => e),
      softDelete: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    mockLogRepo = {
      create: jest.fn((e: any) => ({ ...e })),
      save: jest.fn(async (e: any) => e),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    svc = new ComplianceService(mockWordRepo, mockLogRepo);
  });

  describe('checkText 统一预检', () => {
    it('含多违禁词 → level=high / result=block / score=100，并落日志', async () => {
      const r = await TenantContext.run({ traceId: 'c1', tenantId: TENANT }, () =>
        svc.checkText('本产品是100%国家级最佳', 'script'),
      );
      expect(r.level).toBe('high');
      expect(r.result).toBe('block');
      expect(r.score).toBe(100);
      expect(r.hits.length).toBeGreaterThanOrEqual(3);
      expect(r.hits.some((h) => h.word === '100%')).toBe(true);
      expect(mockLogRepo.save).toHaveBeenCalled();
    });

    it('无违禁词 → level=none / result=pass / score=0', async () => {
      const r = await TenantContext.run({ traceId: 'c2', tenantId: TENANT }, () =>
        svc.checkText('这是一段正常口播内容', 'script'),
      );
      expect(r.level).toBe('none');
      expect(r.result).toBe('pass');
      expect(r.score).toBe(0);
      expect(r.hits).toHaveLength(0);
    });

    it('词库为空首次预检触发 lazy seed（BANNED_WORDS 写入）', async () => {
      await TenantContext.run({ traceId: 'c3', tenantId: TENANT }, () =>
        svc.checkText('最佳', 'script'),
      );
      // ensureWords 在 find 空时 create+save 一批种子词
      expect(mockWordRepo.create).toHaveBeenCalled();
      expect(mockWordRepo.save).toHaveBeenCalled();
    });
  });

  describe('违禁词库 CRUD', () => {
    it('addWord 同词重复 → COMPLIANCE_WORD_EXISTS', async () => {
      mockWordRepo.findOne.mockResolvedValueOnce({ word: '最佳' });
      const dto: AddComplianceWordDto = { word: '最佳' };
      await expect(
        TenantContext.run({ traceId: 'c4', tenantId: TENANT }, () => svc.addWord(dto)),
      ).rejects.toMatchObject({ code: 'COMPLIANCE_WORD_EXISTS' });
    });

    it('addWord 新词 → 创建并返回', async () => {
      mockWordRepo.findOne.mockResolvedValueOnce(undefined);
      const dto: AddComplianceWordDto = { word: '违禁X', level: 'medium', category: '测试' };
      const r = await TenantContext.run({ traceId: 'c5', tenantId: TENANT }, () =>
        svc.addWord(dto),
      );
      expect(mockWordRepo.create).toHaveBeenCalled();
      expect(mockWordRepo.save).toHaveBeenCalled();
      expect(r.word).toBe('违禁X');
    });

    it('updateWord 不存在 → COMPLIANCE_WORD_NOT_FOUND', async () => {
      mockWordRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 'c6', tenantId: TENANT }, () =>
          svc.updateWord(1, { level: 'low' }),
        ),
      ).rejects.toMatchObject({ code: 'COMPLIANCE_WORD_NOT_FOUND' });
    });

    it('removeWord 不存在 → COMPLIANCE_WORD_NOT_FOUND', async () => {
      mockWordRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 'c7', tenantId: TENANT }, () => svc.removeWord(1)),
      ).rejects.toMatchObject({ code: 'COMPLIANCE_WORD_NOT_FOUND' });
    });

    it('listWords 返回标准 {list,total,page,pageSize}', async () => {
      qb.getManyAndCount.mockResolvedValueOnce([
        [{ id: 1, word: '最佳', tenantId: TENANT } as ComplianceWordEntity],
        1,
      ]);
      const r = await TenantContext.run({ traceId: 'c8', tenantId: TENANT }, () =>
        svc.listWords({ page: 1, pageSize: 20 }),
      );
      expect(mockWordRepo.createQueryBuilder).toHaveBeenCalled();
      expect(r.total).toBe(1);
      expect(r.list).toHaveLength(1);
      expect(r.page).toBe(1);
    });
  });

  describe('getLogs 查询', () => {
    it('返回标准 {list,total,page,pageSize}', async () => {
      qb.getManyAndCount.mockResolvedValueOnce([
        [{ id: 1, tenantId: TENANT, scene: 'script' } as ComplianceLogEntity],
        1,
      ]);
      const r = await TenantContext.run({ traceId: 'c9', tenantId: TENANT }, () =>
        svc.getLogs({ page: 1, pageSize: 20, scene: 'script' }),
      );
      expect(mockLogRepo.createQueryBuilder).toHaveBeenCalled();
      expect(r.total).toBe(1);
      expect(r.list).toHaveLength(1);
    });
  });
});
