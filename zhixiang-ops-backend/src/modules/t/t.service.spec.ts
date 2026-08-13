import 'dotenv/config';
import { SelectionService } from './selection.service';
import { TenantContext } from '../../tenant/tenant-context';
import { SelectionProductEntity } from './selection-product.entity';
import { SelectionListEntity } from './selection-list.entity';

/**
 * T 选品中心 单元测试（规划「T 选品中心」详细设计）。
 * SelectionService 直接实例化（不走 Nest DI）；业务调用用 TenantContext.run 包裹。
 */

function buildQueryBuilder() {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
  };
}

function makeProduct(
  p: Partial<SelectionProductEntity> & { id: number; tenantId: string; title: string },
): SelectionProductEntity {
  return {
    source: 'manual',
    commissionRate: 0,
    sales30d: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...p,
  } as SelectionProductEntity;
}

describe('SelectionService', () => {
  let svc: SelectionService;
  let mockProductRepo: any;
  let mockListRepo: any;
  let mockIntegration: any;
  let mockAudit: any;
  let qb: any;

  beforeEach(() => {
    qb = buildQueryBuilder();
    mockAudit = { record: jest.fn().mockResolvedValue({}) };
    mockIntegration = {
      isStandalone: jest.fn().mockReturnValue(true),
      adapters: { product: { getProductsByIds: jest.fn() } },
    };
    mockListRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => e),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      softRemove: jest.fn(async (e: any) => e),
    };
    mockProductRepo = {
      create: jest.fn((e: any) => e),
      save: jest.fn(async (e: any) => e),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    svc = new SelectionService(mockProductRepo, mockListRepo, mockIntegration, mockAudit);
  });

  describe('importSelection', () => {
    it('本地录入 products → 入库带 tenantId + 落审计', async () => {
      const saved = makeProduct({
        id: 1,
        tenantId: 'tn-1',
        title: 'A',
        commissionRate: 20,
        humanDriver: '贪',
      });
      mockProductRepo.save.mockResolvedValueOnce([saved]);

      const result = await TenantContext.run({ traceId: 't1', tenantId: 'tn-1' }, () =>
        svc.importSelection({
          source: 'manual',
          products: [{ title: 'A', commissionRate: 20, humanDriver: '贪' }],
        } as any),
      );

      const persisted = mockProductRepo.save.mock.calls[0][0][0] as SelectionProductEntity;
      expect(persisted.tenantId).toBe('tn-1');
      expect(persisted.title).toBe('A');
      expect(persisted.humanDriver).toBe('贪');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'import_selection', module: 'selection' }),
      );
      expect(result[0].id).toBe(1);
    });

    it('products 与 ids 均空 → SELECTION_IMPORT_EMPTY', async () => {
      await expect(
        TenantContext.run({ traceId: 't2', tenantId: 'tn-1' }, () =>
          svc.importSelection({ source: 'manual' } as any),
        ),
      ).rejects.toMatchObject({ code: 'SELECTION_IMPORT_EMPTY' });
    });

    it('仅传 ids 且 standalone → SELECTION_IMPORT_MODE_UNSUPPORTED', async () => {
      await expect(
        TenantContext.run({ traceId: 't3', tenantId: 'tn-1' }, () =>
          svc.importSelection({ source: 'platform', ids: ['p1'] } as any),
        ),
      ).rejects.toMatchObject({ code: 'SELECTION_IMPORT_MODE_UNSUPPORTED' });
      expect(mockIntegration.adapters.product.getProductsByIds).not.toHaveBeenCalled();
    });

    it('非法 humanDriver → SELECTION_INVALID_HUMAN_DRIVER', async () => {
      await expect(
        TenantContext.run({ traceId: 't4', tenantId: 'tn-1' }, () =>
          svc.importSelection({
            source: 'manual',
            products: [{ title: 'X', humanDriver: 'bad' }],
          } as any),
        ),
      ).rejects.toMatchObject({ code: 'SELECTION_INVALID_HUMAN_DRIVER' });
    });

    it('connected 模式 ids → 经适配层批量拉取落库', async () => {
      mockIntegration.isStandalone.mockReturnValue(false);
      mockIntegration.adapters.product.getProductsByIds.mockResolvedValueOnce([
        { id: 'p1', title: 'P1', price: 9.9 },
      ]);
      const saved = makeProduct({ id: 2, tenantId: 'tn-1', title: 'P1' });
      mockProductRepo.save.mockResolvedValueOnce([saved]);

      const result = await TenantContext.run({ traceId: 't5', tenantId: 'tn-1' }, () =>
        svc.importSelection({ source: 'platform', platform: 'douyin', ids: ['p1'] } as any),
      );

      expect(mockIntegration.adapters.product.getProductsByIds).toHaveBeenCalledWith(['p1']);
      const persisted = mockProductRepo.save.mock.calls[0][0][0] as SelectionProductEntity;
      expect(persisted.externalProductId).toBe('p1');
      expect(persisted.platform).toBe('douyin');
      expect(result[0].id).toBe(2);
    });
  });

  describe('querySelection', () => {
    it('筛选佣金阈值 + 标准分页结构', async () => {
      const rows = [makeProduct({ id: 1, tenantId: 'tn-1', title: 'A', commissionRate: 30 })];
      qb.getManyAndCount.mockResolvedValueOnce([rows, 5]);

      const result = await TenantContext.run({ traceId: 't6', tenantId: 'tn-1' }, () =>
        svc.querySelection({ commissionRateMin: 20, page: 1, pageSize: 20 } as any),
      );

      expect(qb.where).toHaveBeenCalledWith('p.tenantId = :tenantId', { tenantId: 'tn-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('p.commissionRate >= :c', { c: 20 });
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.list[0].title).toBe('A');
    });
  });

  describe('getHot', () => {
    it('返回 surging(销量降序) + darkHorse(高口碑低销量)', async () => {
      const surging = [
        makeProduct({ id: 1, tenantId: 'tn-1', title: '热', sales30d: 100, commissionRate: 10 }),
      ];
      const dark = [
        makeProduct({
          id: 2,
          tenantId: 'tn-1',
          title: '黑马',
          sales30d: 5,
          commissionRate: 40,
          reputationScore: 4.9,
        }),
      ];
      qb.getMany.mockResolvedValueOnce(surging).mockResolvedValueOnce(dark);

      const result = await TenantContext.run({ traceId: 't7', tenantId: 'tn-1' }, () =>
        svc.getHot(),
      );

      expect(result.surging[0].title).toBe('热');
      expect(result.darkHorse[0].title).toBe('黑马');
    });
  });

  describe('getBlueOcean', () => {
    it('按类目聚合，高佣低销得更高蓝海度', async () => {
      mockProductRepo.find.mockResolvedValueOnce([
        makeProduct({
          id: 1,
          tenantId: 'tn-1',
          title: 'a',
          category: '美妆',
          commissionRate: 40,
          sales30d: 10,
        }),
        makeProduct({
          id: 2,
          tenantId: 'tn-1',
          title: 'b',
          category: '食品',
          commissionRate: 10,
          sales30d: 100,
        }),
      ]);

      const result = await TenantContext.run({ traceId: 't8', tenantId: 'tn-1' }, () =>
        svc.getBlueOcean(),
      );

      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('美妆');
      expect(result[0].avgCommissionRate).toBe(40);
    });
  });

  describe('createList / getList / removeList', () => {
    it('引用不存在选品 → SELECTION_PRODUCT_NOT_FOUND', async () => {
      mockProductRepo.count.mockResolvedValueOnce(0);
      await expect(
        TenantContext.run({ traceId: 't9', tenantId: 'tn-1' }, () =>
          svc.createList({ name: 'L', items: [999] } as any),
        ),
      ).rejects.toMatchObject({ code: 'SELECTION_PRODUCT_NOT_FOUND' });
    });

    it('正常创建清单 + 落审计', async () => {
      mockProductRepo.count.mockResolvedValueOnce(1);
      const saved = {
        id: 1,
        tenantId: 'tn-1',
        name: 'L',
        items: [1],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      mockListRepo.save.mockResolvedValueOnce(saved);

      const result = await TenantContext.run({ traceId: 't10', tenantId: 'tn-1' }, () =>
        svc.createList({ name: 'L', items: [1] } as any),
      );

      const persisted = mockListRepo.save.mock.calls[0][0] as SelectionListEntity;
      expect(persisted.tenantId).toBe('tn-1');
      expect(persisted.name).toBe('L');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create_selection_list' }),
      );
      expect(result.itemCount).toBe(1);
    });

    it('getList 展开选品', async () => {
      const list = {
        id: 1,
        tenantId: 'tn-1',
        name: 'L',
        items: [1],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      mockListRepo.findOne.mockResolvedValueOnce(list);
      mockProductRepo.find.mockResolvedValueOnce([
        makeProduct({ id: 1, tenantId: 'tn-1', title: 'A' }),
      ]);

      const result = await TenantContext.run({ traceId: 't11', tenantId: 'tn-1' }, () =>
        svc.getList(1),
      );
      expect(result.products).toHaveLength(1);
      expect(result.products[0].title).toBe('A');
    });

    it('removeList 不存在 → SELECTION_LIST_NOT_FOUND', async () => {
      mockListRepo.findOne.mockResolvedValueOnce(undefined);
      await expect(
        TenantContext.run({ traceId: 't12', tenantId: 'tn-1' }, () => svc.removeList(999)),
      ).rejects.toMatchObject({ code: 'SELECTION_LIST_NOT_FOUND' });
    });

    it('removeList 正常软删 + 落审计', async () => {
      const list = {
        id: 3,
        tenantId: 'tn-1',
        name: 'L',
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      mockListRepo.findOne.mockResolvedValueOnce(list);

      const result = await TenantContext.run({ traceId: 't13', tenantId: 'tn-1' }, () =>
        svc.removeList(3),
      );
      expect(mockListRepo.softRemove).toHaveBeenCalledWith(list);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete_selection_list', resource: 'id:3' }),
      );
      expect(result).toEqual({ id: 3 });
    });
  });

  describe('跨租户隔离', () => {
    it('import 入库 tenantId 与上下文一致', async () => {
      const saved = makeProduct({ id: 1, tenantId: 'tn-2', title: 'A' });
      mockProductRepo.save.mockResolvedValueOnce([saved]);
      await TenantContext.run({ traceId: 't14', tenantId: 'tn-2' }, () =>
        svc.importSelection({ source: 'manual', products: [{ title: 'A' }] } as any),
      );
      expect(mockProductRepo.save.mock.calls[0][0][0].tenantId).toBe('tn-2');
    });
  });
});
