import 'dotenv/config';
import { Repository } from 'typeorm';
import { ProductService } from './product.service';
import { TenantContext } from '../../tenant/tenant-context';
import { IntegrationService } from '../../integration/integration.service';
import { SkillGateway } from '../../skill/skill.gateway';
import { AuditService } from '../n/audit.service';
import { ProductEntity } from './product.entity';
import { ProductContentEntity } from './product-content.entity';
import { ProductDetailPageEntity } from './product-detail-page.entity';
import { SelectionProductEntity } from '../t/selection-product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { GenerateContentDto } from './dto/generate-content.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateDetailPageDto } from './dto/create-detail-page.dto';

/**
 * R 商品内容中心 单元测试（规划「R 商品内容中心」详细设计）。
 * ProductService 直接实例化（不走 Nest DI）；业务调用用 TenantContext.run 包裹。
 *
 * Mock 全部强类型化：Repository 用最小 Repo<T> 接口，integration/skill/audit 用最小接口。
 * 桥接处用 as unknown as 转真实类型；不出现 any，内联对象字面量用 as unknown as Entity 构造。
 */

type FindOpts = { where: Record<string, unknown> };

type Repo<T> = {
  create: jest.Mock<T, [Partial<T>]>;
  save: jest.Mock<Promise<T>, [Partial<T>]>;
  findOne: jest.Mock<Promise<T | null>, [FindOpts]>;
  find: jest.Mock<Promise<T[]>, [FindOpts]>;
};

function makeSelection(
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

describe('ProductService', () => {
  let svc: ProductService;
  let mockProductRepo: Repo<ProductEntity>;
  let mockContentRepo: Repo<ProductContentEntity>;
  let mockDetailRepo: Repo<ProductDetailPageEntity>;
  let mockSelectionRepo: Repo<SelectionProductEntity>;
  let mockIntegration: {
    isStandalone: jest.Mock<boolean, []>;
    adapters: {
      product: {
        getProduct: jest.Mock<Promise<{ id: string; title: string; price: number }>, [string]>;
      };
    };
  };
  let mockSkill: { generateText: jest.Mock<Promise<string>, [unknown?]> };
  let mockAudit: { record: jest.Mock<Promise<unknown>, [unknown?]> };

  beforeEach(() => {
    mockAudit = { record: jest.fn<Promise<unknown>, [unknown?]>().mockResolvedValue({}) };
    mockSkill = {
      generateText: jest.fn<Promise<string>, [unknown?]>().mockResolvedValue('AI文本'),
    };
    mockIntegration = {
      isStandalone: jest.fn<boolean, []>().mockReturnValue(true),
      adapters: {
        product: {
          getProduct: jest.fn<Promise<{ id: string; title: string; price: number }>, [string]>(),
        },
      },
    };
    mockSelectionRepo = {
      create: jest.fn<SelectionProductEntity, [Partial<SelectionProductEntity>]>(
        (e) => e as SelectionProductEntity,
      ),
      save: jest
        .fn<Promise<SelectionProductEntity>, [Partial<SelectionProductEntity>]>()
        .mockImplementation((e) => Promise.resolve(e as SelectionProductEntity)),
      findOne: jest.fn<Promise<SelectionProductEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<SelectionProductEntity[]>, [FindOpts]>().mockResolvedValue([]),
    };
    mockDetailRepo = {
      create: jest.fn<ProductDetailPageEntity, [Partial<ProductDetailPageEntity>]>(
        (e) => e as ProductDetailPageEntity,
      ),
      save: jest
        .fn<Promise<ProductDetailPageEntity>, [Partial<ProductDetailPageEntity>]>()
        .mockImplementation((e) =>
          Promise.resolve({ ...e, id: e.id ?? 1 } as unknown as ProductDetailPageEntity),
        ),
      findOne: jest.fn<Promise<ProductDetailPageEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<ProductDetailPageEntity[]>, [FindOpts]>().mockResolvedValue([]),
    };
    mockContentRepo = {
      create: jest.fn<ProductContentEntity, [Partial<ProductContentEntity>]>(
        (e) => e as ProductContentEntity,
      ),
      save: jest
        .fn<Promise<ProductContentEntity>, [Partial<ProductContentEntity>]>()
        .mockImplementation((e) =>
          Promise.resolve({ ...e, id: e.id ?? 1 } as unknown as ProductContentEntity),
        ),
      findOne: jest.fn<Promise<ProductContentEntity | null>, [FindOpts]>(),
      find: jest.fn<Promise<ProductContentEntity[]>, [FindOpts]>().mockResolvedValue([]),
    };
    mockProductRepo = {
      create: jest.fn<ProductEntity, [Partial<ProductEntity>]>((e) => e as ProductEntity),
      save: jest
        .fn<Promise<ProductEntity>, [Partial<ProductEntity>]>()
        .mockImplementation((e) =>
          Promise.resolve({ ...e, id: e.id ?? 1 } as unknown as ProductEntity),
        ),
      find: jest.fn<Promise<ProductEntity[]>, [FindOpts]>().mockResolvedValue([]),
      findOne: jest.fn<Promise<ProductEntity | null>, [FindOpts]>(),
    };
    svc = new ProductService(
      mockProductRepo as unknown as Repository<ProductEntity>,
      mockContentRepo as unknown as Repository<ProductContentEntity>,
      mockDetailRepo as unknown as Repository<ProductDetailPageEntity>,
      mockSelectionRepo as unknown as Repository<SelectionProductEntity>,
      mockIntegration as unknown as IntegrationService,
      mockSkill as unknown as SkillGateway,
      mockAudit as unknown as AuditService,
    );
  });

  // —— 验收点 1：商品接入（三源） ——
  describe('ingest 接入', () => {
    it('manual 接入 → 入库带 tenantId + 落审计', async () => {
      const dto: CreateProductDto = {
        sourceType: 'manual',
        title: '手动商品',
        stock: 10,
        category: '美妆',
        humanDriver: '贪',
      };
      const saved = await TenantContext.run({ traceId: 'r1', tenantId: 'tn-1' }, () =>
        svc.ingest(dto),
      );

      const persisted = mockProductRepo.save.mock.calls[0][0] as unknown as ProductEntity;
      expect(persisted.tenantId).toBe('tn-1');
      expect(persisted.title).toBe('手动商品');
      expect(persisted.humanDriver).toBe('贪');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'import_product', module: 'product' }),
      );
      expect(saved.id).toBe(1);
    });

    it('t_selection 接入 → 从 T 选品继承 humanDriver/title/category/price', async () => {
      const sel = makeSelection({
        id: 5,
        tenantId: 'tn-1',
        title: '选品X',
        humanDriver: '贪',
        price: 9.9,
        category: '美妆',
      });
      mockSelectionRepo.findOne.mockResolvedValueOnce(sel);

      const dto: CreateProductDto = { sourceType: 't_selection', selectionProductId: 5 };
      const saved = await TenantContext.run({ traceId: 'r2', tenantId: 'tn-1' }, () =>
        svc.ingest(dto),
      );

      expect(mockSelectionRepo.findOne).toHaveBeenCalled();
      const persisted = mockProductRepo.save.mock.calls[0][0] as unknown as ProductEntity;
      expect(persisted.title).toBe('选品X');
      expect(persisted.humanDriver).toBe('贪');
      expect(persisted.category).toBe('美妆');
      expect(persisted.price).toBe(9.9);
      expect(persisted.selectionProductId).toBe(5);
      expect(saved.id).toBe(1);
    });

    it('t_selection 缺 selectionProductId → PRODUCT_SELECTION_REQUIRED', async () => {
      const dto: CreateProductDto = { sourceType: 't_selection' };
      await expect(
        TenantContext.run({ traceId: 'r3', tenantId: 'tn-1' }, () => svc.ingest(dto)),
      ).rejects.toMatchObject({ code: 'PRODUCT_SELECTION_REQUIRED' });
    });

    it('t_selection 关联不存在 → PRODUCT_SELECTION_NOT_FOUND', async () => {
      mockSelectionRepo.findOne.mockResolvedValueOnce(null);
      const dto: CreateProductDto = { sourceType: 't_selection', selectionProductId: 999 };
      await expect(
        TenantContext.run({ traceId: 'r4', tenantId: 'tn-1' }, () => svc.ingest(dto)),
      ).rejects.toMatchObject({ code: 'PRODUCT_SELECTION_NOT_FOUND' });
    });

    it('system + standalone → PRODUCT_SOURCE_UNSUPPORTED_IN_STANDALONE', async () => {
      const dto: CreateProductDto = { sourceType: 'system', externalProductId: 'ext-1' };
      await expect(
        TenantContext.run({ traceId: 'r5', tenantId: 'tn-1' }, () => svc.ingest(dto)),
      ).rejects.toMatchObject({ code: 'PRODUCT_SOURCE_UNSUPPORTED_IN_STANDALONE' });
      expect(mockIntegration.adapters.product.getProduct).not.toHaveBeenCalled();
    });

    it('system + connected + externalProductId → 经适配层拉取落库', async () => {
      mockIntegration.isStandalone.mockReturnValue(false);
      mockIntegration.adapters.product.getProduct.mockResolvedValueOnce({
        id: 'ext-1',
        title: '外部商品',
        price: 19.9,
      });

      const dto: CreateProductDto = { sourceType: 'system', externalProductId: 'ext-1' };
      const saved = await TenantContext.run({ traceId: 'r6', tenantId: 'tn-1' }, () =>
        svc.ingest(dto),
      );

      expect(mockIntegration.adapters.product.getProduct).toHaveBeenCalledWith('ext-1');
      const persisted = mockProductRepo.save.mock.calls[0][0] as unknown as ProductEntity;
      expect(persisted.externalProductId).toBe('ext-1');
      expect(persisted.title).toBe('外部商品');
      expect(persisted.price).toBe(19.9);
      expect(saved.id).toBe(1);
    });

    it('manual 缺 title → PRODUCT_TITLE_REQUIRED', async () => {
      const dto: CreateProductDto = { sourceType: 'manual' };
      await expect(
        TenantContext.run({ traceId: 'r7', tenantId: 'tn-1' }, () => svc.ingest(dto)),
      ).rejects.toMatchObject({ code: 'PRODUCT_TITLE_REQUIRED' });
    });

    it('非法 humanDriver → PRODUCT_INVALID_HUMAN_DRIVER', async () => {
      const dto: CreateProductDto = { sourceType: 'manual', title: 'X', humanDriver: 'bad' };
      await expect(
        TenantContext.run({ traceId: 'r8', tenantId: 'tn-1' }, () => svc.ingest(dto)),
      ).rejects.toMatchObject({ code: 'PRODUCT_INVALID_HUMAN_DRIVER' });
    });
  });

  // —— 验收点 2：generateContent AI 生成 ——
  describe('generateContent AI 生成', () => {
    it('调用 SkillGateway 5 次生成全字段 + 落审计 + 版本自增', async () => {
      mockProductRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        title: '商品',
        category: '美妆',
        humanDriver: '贪',
        stock: 0,
      } as unknown as ProductEntity);
      mockContentRepo.findOne.mockResolvedValueOnce(null); // 首版 version=1

      const gDto: GenerateContentDto = { platform: 'douyin' };
      const result = await TenantContext.run({ traceId: 'r9', tenantId: 'tn-1' }, () =>
        svc.generateContent(1, gDto),
      );

      expect(mockSkill.generateText).toHaveBeenCalledTimes(5);
      expect(result.titleAi).toBe('AI文本');
      expect(result.sellingPoint).toBe('AI文本');
      expect(result.script).toBe('AI文本');
      expect(result.xhsCopy).toBe('AI文本');
      expect(result.version).toBe(1);
      expect(result.humanDriver).toBe('贪');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'generate_product_content', module: 'product' }),
      );
    });

    it('生成内容非 JSON → content 存 raw 文本', async () => {
      mockProductRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        title: '商品',
        stock: 0,
      } as unknown as ProductEntity);
      mockContentRepo.findOne.mockResolvedValueOnce(null);

      const gDto: GenerateContentDto = {};
      const result = await TenantContext.run({ traceId: 'r10', tenantId: 'tn-1' }, () =>
        svc.generateContent(1, gDto),
      );
      expect(result.content?.raw).toBe('AI文本');
    });
  });

  // —— 验收点 3：checkCompliance 合规校验（P 内嵌兜底） ——
  describe('checkCompliance 合规校验', () => {
    it('命中绝对化违禁词 → high 风险 + 落审计', async () => {
      mockProductRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        title: '国家级精品',
        stock: 0,
      } as unknown as ProductEntity);
      mockContentRepo.findOne.mockResolvedValueOnce({
        id: 2,
        tenantId: 'tn-1',
        titleAi: '最强',
        sellingPoint: '',
        script: '',
        xhsCopy: '',
        content: {},
      } as unknown as ProductContentEntity);

      const res = await TenantContext.run({ traceId: 'r11', tenantId: 'tn-1' }, () =>
        svc.checkCompliance(1),
      );
      expect(res.risk).toBe('high');
      expect(res.hits.length).toBeGreaterThan(0);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'check_product_compliance', module: 'product' }),
      );
    });

    it('无违禁词 → none 风险', async () => {
      mockProductRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        title: '日常好物',
        stock: 0,
      } as unknown as ProductEntity);
      mockContentRepo.findOne.mockResolvedValueOnce({
        id: 2,
        tenantId: 'tn-1',
        titleAi: '好用',
        sellingPoint: '',
        script: '',
        xhsCopy: '',
        content: {},
      } as unknown as ProductContentEntity);

      const res = await TenantContext.run({ traceId: 'r12', tenantId: 'tn-1' }, () =>
        svc.checkCompliance(1),
      );
      expect(res.risk).toBe('none');
      expect(res.hits).toHaveLength(0);
    });

    it('内容不存在 → PRODUCT_CONTENT_NOT_FOUND', async () => {
      mockProductRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        title: 'X',
        stock: 0,
      } as unknown as ProductEntity);
      mockContentRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        TenantContext.run({ traceId: 'r13', tenantId: 'tn-1' }, () => svc.checkCompliance(1)),
      ).rejects.toMatchObject({ code: 'PRODUCT_CONTENT_NOT_FOUND' });
    });
  });

  // —— 验收点 4：detail-page / stock ——
  describe('detail-page / stock', () => {
    it('生成详情页 → 保存 sections + 落审计', async () => {
      mockProductRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        title: 'X',
        stock: 0,
      } as unknown as ProductEntity);
      const dDto: CreateDetailPageDto = { sections: [{ title: '区块1', body: '内容' }] };
      const res = await TenantContext.run({ traceId: 'r14', tenantId: 'tn-1' }, () =>
        svc.createDetailPage(1, dDto),
      );
      expect(res.sections).toHaveLength(1);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create_product_detail_page', module: 'product' }),
      );
    });

    it('库存扣减（负 delta）→ 返回新 stock', async () => {
      mockProductRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        title: 'X',
        stock: 10,
      } as unknown as ProductEntity);
      const sDto: UpdateStockDto = { delta: -3, reason: '订单扣减' };
      const res = await TenantContext.run({ traceId: 'r15', tenantId: 'tn-1' }, () =>
        svc.updateStock(1, sDto),
      );
      expect(res.stock).toBe(7);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update_product_stock', module: 'product' }),
      );
    });

    it('库存回写（正 delta）→ 入库', async () => {
      mockProductRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        title: 'X',
        stock: 10,
      } as unknown as ProductEntity);
      const sDto: UpdateStockDto = { delta: 5 };
      const res = await TenantContext.run({ traceId: 'r16', tenantId: 'tn-1' }, () =>
        svc.updateStock(1, sDto),
      );
      expect(res.stock).toBe(15);
    });

    it('扣减后为负 → PRODUCT_STOCK_INSUFFICIENT', async () => {
      mockProductRepo.findOne.mockResolvedValueOnce({
        id: 1,
        tenantId: 'tn-1',
        title: 'X',
        stock: 2,
      } as unknown as ProductEntity);
      const sDto: UpdateStockDto = { delta: -5 };
      await expect(
        TenantContext.run({ traceId: 'r17', tenantId: 'tn-1' }, () => svc.updateStock(1, sDto)),
      ).rejects.toMatchObject({ code: 'PRODUCT_STOCK_INSUFFICIENT' });
    });
  });

  // —— 验收点 5：跨租户隔离 ——
  describe('跨租户隔离', () => {
    it('ingest 入库 tenantId 与上下文一致', async () => {
      const dto: CreateProductDto = { sourceType: 'manual', title: 'A', stock: 0 };
      await TenantContext.run({ traceId: 'r18', tenantId: 'tn-2' }, () => svc.ingest(dto));
      const persisted = mockProductRepo.save.mock.calls[0][0] as unknown as ProductEntity;
      expect(persisted.tenantId).toBe('tn-2');
    });
  });
});
