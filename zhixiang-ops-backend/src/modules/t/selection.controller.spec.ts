import { SelectionController } from './selection.controller';

describe('SelectionController', () => {
  let controller: SelectionController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(() => {
    svc = {
      importSelection: jest.fn(),
      querySelection: jest.fn(),
      getHot: jest.fn(),
      getBlueOcean: jest.fn(),
      createList: jest.fn(),
      getLists: jest.fn(),
      getList: jest.fn(),
      removeList: jest.fn(),
    };
    controller = new SelectionController(svc as any);
  });

  it('import 委托 svc.importSelection 并原样返回', async () => {
    const dto = { source: 'system' } as any;
    svc.importSelection.mockResolvedValue({ count: 5 });
    await expect(controller.import(dto)).resolves.toEqual({ count: 5 });
    expect(svc.importSelection).toHaveBeenCalledWith(dto);
  });

  it('list 委托 svc.querySelection 并原样返回', async () => {
    const filter = { category: '美妆' } as any;
    svc.querySelection.mockResolvedValue({ items: [] });
    await expect(controller.list(filter)).resolves.toEqual({ items: [] });
    expect(svc.querySelection).toHaveBeenCalledWith(filter);
  });

  it('hot 委托 svc.getHot 并原样返回', async () => {
    svc.getHot.mockResolvedValue({ items: [] });
    await expect(controller.hot()).resolves.toEqual({ items: [] });
    expect(svc.getHot).toHaveBeenCalledWith();
  });

  it('blueOcean 委托 svc.getBlueOcean 并原样返回', async () => {
    svc.getBlueOcean.mockResolvedValue({ words: [] });
    await expect(controller.blueOcean()).resolves.toEqual({ words: [] });
    expect(svc.getBlueOcean).toHaveBeenCalledWith();
  });

  it('createList 委托 svc.createList 并原样返回', async () => {
    const dto = { name: 'n' } as any;
    svc.createList.mockResolvedValue({ id: 1 });
    await expect(controller.createList(dto)).resolves.toEqual({ id: 1 });
    expect(svc.createList).toHaveBeenCalledWith(dto);
  });

  it('lists 委托 svc.getLists 并原样返回', async () => {
    svc.getLists.mockResolvedValue([{ id: 1 }]);
    await expect(controller.lists()).resolves.toEqual([{ id: 1 }]);
    expect(svc.getLists).toHaveBeenCalledWith();
  });

  it('listDetail 将 id 转换为 Number 并原样返回', async () => {
    svc.getList.mockResolvedValue({ id: 2 });
    await expect(controller.listDetail('2')).resolves.toEqual({ id: 2 });
    expect(svc.getList).toHaveBeenCalledWith(2);
  });

  it('removeList 将 id 转换为 Number 并原样返回', async () => {
    svc.removeList.mockResolvedValue({ removed: true });
    await expect(controller.removeList('3')).resolves.toEqual({ removed: true });
    expect(svc.removeList).toHaveBeenCalledWith(3);
  });
});
