import { ProductPipelineService } from './product-pipeline.service';
import { ProductPipelineRunEntity } from './product-pipeline-run.entity';
import { ProductService } from '../r/product.service';
import { IntelService } from '../intel/intel.service';
import { ShelfService } from './shelf.service';
import { SkillGateway } from '../../skill/skill.gateway';
import { SHELF_ADAPTERS } from './shelf.adapters';
import { TenantContext } from '../../tenant/tenant-context';
import { createMockRepo, MockRepo } from '../../test-utils/mock-repo';

/**
 * ProductPipelineService（商品全自动流水线）单元测试。
 * 验证"一个环节都不能少"：识图卖点→卖点搜索→自动填商品→详情页→多平台发布 五环节顺序执行。
 */

const TENANT = 'tn-1';

function makeRun(partial: Partial<ProductPipelineRunEntity> = {}): ProductPipelineRunEntity {
  return {
    id: 1,
    tenantId: TENANT,
    status: 'running',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as ProductPipelineRunEntity;
}

describe('ProductPipelineService 全自动流水线', () => {
  let svc: ProductPipelineService;
  let mockRunRepo: MockRepo<ProductPipelineRunEntity>;
  let mockProducts: {
    ingest: jest.Mock;
    generateContent: jest.Mock;
    createDetailPage: jest.Mock;
    checkCompliance: jest.Mock;
    getOwned: jest.Mock;
  };
  let mockIntel: { mineKeywords: jest.Mock; getHot: jest.Mock };
  let mockShelf: { recordPublicationWithRule: jest.Mock };
  let mockSkill: { generateText: jest.Mock };

  beforeEach(() => {
    mockRunRepo = createMockRepo<ProductPipelineRunEntity>();
    mockRunRepo.save.mockImplementation((e: Partial<ProductPipelineRunEntity>) =>
      Promise.resolve({ ...makeRun(), ...e } as ProductPipelineRunEntity),
    );
    mockProducts = {
      ingest: jest
        .fn()
        .mockResolvedValue({ id: 10, title: '香薰蜡烛·治愈', price: 99, category: '家居' }),
      generateContent: jest.fn().mockResolvedValue({
        content: { sections: [{ title: '卖点', body: '治愈' }] },
        sellingPoint: '治愈感',
      }),
      createDetailPage: jest.fn().mockResolvedValue({ id: 5 }),
      checkCompliance: jest.fn().mockResolvedValue({ risk: 'none', hits: [] }),
      getOwned: jest.fn().mockResolvedValue({
        id: 10,
        tenantId: TENANT,
        title: '香薰蜡烛·治愈',
        stock: 100,
        price: 99,
        category: '家居',
      }),
    };
    mockIntel = {
      mineKeywords: jest.fn().mockResolvedValue(['香薰', '助眠', '送礼']),
      getHot: jest.fn().mockResolvedValue([{ title: '助眠好物' }, { title: '治愈系' }]),
    };
    mockShelf = {
      recordPublicationWithRule: jest
        .fn()
        .mockResolvedValue({ platformRecord: { id: 1 }, rule: { id: 1 } }),
    };
    mockSkill = {
      generateText: jest.fn().mockRejectedValue(new Error('LLM 不可用')),
    };
    svc = new ProductPipelineService(
      mockRunRepo as never,
      mockProducts as unknown as ProductService,
      mockIntel as unknown as IntelService,
      mockShelf as unknown as ShelfService,
      mockSkill as unknown as SkillGateway,
    );
  });

  it('五环节顺序执行：识图→搜索→填商品→详情页→多平台发布', async () => {
    const res = await TenantContext.run({ traceId: 'p1', tenantId: TENANT }, () =>
      svc.runPipeline(
        { filename: 'aroma-candle.jpg', path: '/tmp/x.jpg', mimetype: 'image/jpeg', size: 100 },
        { publishPlatforms: ['douyin-shop', 'taobao'] },
      ),
    );
    expect(res.status).toBe('done');
    expect(res.productId).toBe(10);
    const stepKeys = Object.keys(res.steps);
    expect(stepKeys).toEqual(['recognize', 'search', 'fill', 'detail', 'publish']);
    for (const k of stepKeys) {
      expect(res.steps[k].ok).toBe(true);
    }
    expect(mockProducts.ingest).toHaveBeenCalledTimes(1);
    expect(mockProducts.generateContent).toHaveBeenCalledTimes(1);
    expect(mockProducts.createDetailPage).toHaveBeenCalledTimes(1);
    expect(mockProducts.checkCompliance).toHaveBeenCalledTimes(1);
    expect(mockShelf.recordPublicationWithRule).toHaveBeenCalledTimes(2); // 每平台单事务落平台映射+规则
    expect(res.publishedTo?.length).toBe(2);
  });

  it('自动填商品：标题含识别词与卖点，类目按关键词推断', async () => {
    const res = await TenantContext.run({ traceId: 'p2', tenantId: TENANT }, () =>
      svc.runPipeline(
        { filename: 'food-snack.jpg', path: '/tmp/x.jpg', mimetype: 'image/jpeg', size: 100 },
        { publishPlatforms: ['taobao'] },
      ),
    );
    const ingestArg = mockProducts.ingest.mock.calls[0][0];
    expect(ingestArg.title).toContain('food');
    expect(ingestArg.category).toBe('食品');
    expect(ingestArg.stock).toBe(100);
    expect(res.status).toBe('done');
  });

  it('无图片文件时走规则化识别（降级不中断）', async () => {
    const res = await TenantContext.run({ traceId: 'p3', tenantId: TENANT }, () =>
      svc.runPipeline(
        { filename: '商品图片', path: '', mimetype: 'image/jpeg', size: 0 },
        { publishPlatforms: ['taobao'] },
      ),
    );
    expect(res.steps.recognize.ok).toBe(true);
    expect(res.status).toBe('done');
  });

  it('自动填商品失败则流水线标记 failed（环节不能静默跳过）', async () => {
    mockProducts.ingest.mockRejectedValueOnce(new Error('商品创建失败'));
    const res = await TenantContext.run({ traceId: 'p4', tenantId: TENANT }, () =>
      svc.runPipeline(
        { filename: 'candle.jpg', path: '/tmp/x.jpg', mimetype: 'image/jpeg', size: 100 },
        { publishPlatforms: ['taobao'] },
      ),
    );
    expect(res.status).toBe('failed');
    expect(res.steps.fill.ok).toBe(false);
    expect(res.errorMsg).toContain('商品创建失败');
  });

  it('全部平台发布失败 → publish 环节 failed', async () => {
    mockProducts.getOwned.mockResolvedValueOnce({
      id: 10,
      tenantId: TENANT,
      title: '超'.repeat(100), // 触发淘宝 60 字标题限制
      stock: 100,
      price: 99,
      category: null,
    });
    const res = await TenantContext.run({ traceId: 'p5', tenantId: TENANT }, () =>
      svc.runPipeline(
        { filename: 'candle.jpg', path: '/tmp/x.jpg', mimetype: 'image/jpeg', size: 100 },
        { publishPlatforms: ['taobao'] },
      ),
    );
    expect(res.steps.publish.ok).toBe(false);
    expect(res.status).toBe('partial');
  });
});

describe('平台发布适配差异', () => {
  it('淘宝发布超 60 字标题预检拒绝', async () => {
    await expect(
      SHELF_ADAPTERS.taobao.publishProduct({
        title: '超'.repeat(61),
        stock: 1,
        tenantId: 't',
        platform: 'taobao',
      }),
    ).rejects.toMatchObject({ code: 'SHELF_PRECHECK_FAILED' });
  });

  it('抖店发布进入审核（pending_review），淘宝即时 on_sale', async () => {
    const base = { title: 'ok', stock: 1, tenantId: 't' } as const;
    const douyin = await SHELF_ADAPTERS['douyin-shop'].publishProduct({
      ...base,
      category: '食品',
      platform: 'douyin-shop',
    });
    expect(douyin.status).toBe('pending_review');
    const taobao = await SHELF_ADAPTERS.taobao.publishProduct({
      ...base,
      platform: 'taobao',
    });
    expect(taobao.status).toBe('on_sale');
    expect(taobao.extProductId).toMatch(/^prod_/);
  });
});
