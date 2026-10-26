import { EcommerceController } from './shelf.controller';
import { ECOMMERCE_PLATFORMS, ECOMMERCE_PLATFORM_META } from './ecommerce.types';

describe('EcommerceController', () => {
  let controller: EcommerceController;
  let shelf: { [k: string]: jest.Mock };
  let pipeline: { [k: string]: jest.Mock };

  beforeEach(() => {
    shelf = {
      createRule: jest.fn(),
      listRules: jest.fn(),
      updateRule: jest.fn(),
      removeRule: jest.fn(),
      runShelfCycle: jest.fn(),
      listJobs: jest.fn(),
      listProductPlatforms: jest.fn(),
    };
    pipeline = {
      runPipeline: jest.fn(),
      listRuns: jest.fn(),
      getRun: jest.fn(),
    };
    controller = new EcommerceController(shelf as any, pipeline as any);
  });

  it('platforms 返回各平台规则差异元信息（不依赖服务）', () => {
    expect(controller.platforms()).toEqual(
      ECOMMERCE_PLATFORMS.map((p) => ECOMMERCE_PLATFORM_META[p]),
    );
  });

  it('createRule 委托 shelf.createRule 并原样返回', async () => {
    const dto = { platform: 'taobao' } as any;
    shelf.createRule.mockResolvedValue({ id: 1 });
    await expect(controller.createRule(dto)).resolves.toEqual({ id: 1 });
    expect(shelf.createRule).toHaveBeenCalledWith(dto);
  });

  it('listRules 汇总查询参数后委托 shelf.listRules', async () => {
    shelf.listRules.mockResolvedValue({ items: [] });
    await expect(controller.listRules('taobao', 'price', 'active')).resolves.toEqual({ items: [] });
    expect(shelf.listRules).toHaveBeenCalledWith({
      platform: 'taobao',
      strategy: 'price',
      status: 'active',
    });
  });

  it('listRules 无参数时传全 undefined 对象', async () => {
    shelf.listRules.mockResolvedValue({ items: [] });
    await expect(controller.listRules()).resolves.toEqual({ items: [] });
    expect(shelf.listRules).toHaveBeenCalledWith({
      platform: undefined,
      strategy: undefined,
      status: undefined,
    });
  });

  it('updateRule 将 id 转换为 Number 并原样返回', async () => {
    const dto = { status: 'active' } as any;
    shelf.updateRule.mockResolvedValue({ id: 2 });
    await expect(controller.updateRule('2', dto)).resolves.toEqual({ id: 2 });
    expect(shelf.updateRule).toHaveBeenCalledWith(2, dto);
  });

  it('removeRule 将 id 转换为 Number 并原样返回', async () => {
    shelf.removeRule.mockResolvedValue({ removed: true });
    await expect(controller.removeRule('3')).resolves.toEqual({ removed: true });
    expect(shelf.removeRule).toHaveBeenCalledWith(3);
  });

  it('run 透传 tenantId 委托 shelf.runShelfCycle', async () => {
    shelf.runShelfCycle.mockResolvedValue({ ran: true });
    await expect(controller.run('tn-x')).resolves.toEqual({ ran: true });
    expect(shelf.runShelfCycle).toHaveBeenCalledWith('tn-x');
  });

  it('run 不带 tenantId 时传 undefined', async () => {
    shelf.runShelfCycle.mockResolvedValue({ ran: true });
    await expect(controller.run()).resolves.toEqual({ ran: true });
    expect(shelf.runShelfCycle).toHaveBeenCalledWith(undefined);
  });

  it('listJobs 汇总查询参数后委托 shelf.listJobs', async () => {
    shelf.listJobs.mockResolvedValue({ items: [] });
    await expect(controller.listJobs('taobao', 'done', '9')).resolves.toEqual({ items: [] });
    expect(shelf.listJobs).toHaveBeenCalledWith({
      platform: 'taobao',
      status: 'done',
      productId: '9',
    });
  });

  it('listProducts 汇总查询参数后委托 shelf.listProductPlatforms', async () => {
    shelf.listProductPlatforms.mockResolvedValue({ items: [] });
    await expect(controller.listProducts('taobao', 'on_sale')).resolves.toEqual({ items: [] });
    expect(shelf.listProductPlatforms).toHaveBeenCalledWith({
      platform: 'taobao',
      shelfStatus: 'on_sale',
    });
  });

  it('runPipeline 无 file 时用规范化默认文件对象并原样返回', async () => {
    const opts = { platform: 'taobao' } as any;
    pipeline.runPipeline.mockResolvedValue({ runId: 1 });
    await expect(controller.runPipeline(undefined, opts)).resolves.toEqual({ runId: 1 });
    expect(pipeline.runPipeline).toHaveBeenCalledWith(
      { filename: '商品图片', path: '', mimetype: 'image/jpeg', size: 0 },
      opts,
    );
  });

  it('runPipeline 有 file 时按上传字段规范化并原样返回', async () => {
    const file = {
      originalname: 'a.png',
      path: '/tmp/a.png',
      mimetype: 'image/png',
      size: 1024,
    } as any;
    const opts = { platform: 'shopify' } as any;
    pipeline.runPipeline.mockResolvedValue({ runId: 2 });
    await expect(controller.runPipeline(file, opts)).resolves.toEqual({ runId: 2 });
    expect(pipeline.runPipeline).toHaveBeenCalledWith(
      { filename: 'a.png', path: '/tmp/a.png', mimetype: 'image/png', size: 1024 },
      opts,
    );
  });

  it('listRuns 委托 pipeline.listRuns 并原样返回', async () => {
    pipeline.listRuns.mockResolvedValue([{ id: 1 }]);
    await expect(controller.listRuns()).resolves.toEqual([{ id: 1 }]);
    expect(pipeline.listRuns).toHaveBeenCalledWith();
  });

  it('getRun 将 id 转换为 Number 并原样返回', async () => {
    pipeline.getRun.mockResolvedValue({ id: 5 });
    await expect(controller.getRun('5')).resolves.toEqual({ id: 5 });
    expect(pipeline.getRun).toHaveBeenCalledWith(5);
  });
});
