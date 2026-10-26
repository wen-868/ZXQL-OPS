import { ProductController } from './product.controller';

describe('ProductController', () => {
  let controller: ProductController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(() => {
    svc = {
      ingest: jest.fn(),
      list: jest.fn(),
      generateContent: jest.fn(),
      getContent: jest.fn(),
      checkCompliance: jest.fn(),
      createDetailPage: jest.fn(),
      updateStock: jest.fn(),
    };
    controller = new ProductController(svc as any);
  });

  it('ingest 委托 svc.ingest 并原样返回', async () => {
    const dto = { source: 'manual' } as any;
    svc.ingest.mockResolvedValue({ id: 1 });
    await expect(controller.ingest(dto)).resolves.toEqual({ id: 1 });
    expect(svc.ingest).toHaveBeenCalledWith(dto);
  });

  it('list 透传 category 并原样返回', async () => {
    svc.list.mockResolvedValue({ items: [] });
    await expect(controller.list('美妆')).resolves.toEqual({ items: [] });
    expect(svc.list).toHaveBeenCalledWith('美妆');
  });

  it('list 无 category 时传 undefined', async () => {
    svc.list.mockResolvedValue({ items: [] });
    await expect(controller.list()).resolves.toEqual({ items: [] });
    expect(svc.list).toHaveBeenCalledWith(undefined);
  });

  it('generate 将 id 转换为 Number 并原样返回', async () => {
    const dto = { kinds: ['title'] } as any;
    svc.generateContent.mockResolvedValue({ content: {} });
    await expect(controller.generate('2', dto)).resolves.toEqual({ content: {} });
    expect(svc.generateContent).toHaveBeenCalledWith(2, dto);
  });

  it('content 将 id 转换为 Number 并原样返回', async () => {
    svc.getContent.mockResolvedValue({ title: 't' });
    await expect(controller.content('3')).resolves.toEqual({ title: 't' });
    expect(svc.getContent).toHaveBeenCalledWith(3);
  });

  it('check 将 id 转换为 Number 并原样返回', async () => {
    svc.checkCompliance.mockResolvedValue({ pass: true });
    await expect(controller.check('4')).resolves.toEqual({ pass: true });
    expect(svc.checkCompliance).toHaveBeenCalledWith(4);
  });

  it('detailPage 将 id 转换为 Number 并原样返回', async () => {
    const dto = { template: 'tpl' } as any;
    svc.createDetailPage.mockResolvedValue({ id: 5 });
    await expect(controller.detailPage('5', dto)).resolves.toEqual({ id: 5 });
    expect(svc.createDetailPage).toHaveBeenCalledWith(5, dto);
  });

  it('stock 将 id 转换为 Number 并原样返回', async () => {
    const dto = { delta: -1 } as any;
    svc.updateStock.mockResolvedValue({ stock: 9 });
    await expect(controller.stock('6', dto)).resolves.toEqual({ stock: 9 });
    expect(svc.updateStock).toHaveBeenCalledWith(6, dto);
  });
});
