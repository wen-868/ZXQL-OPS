import { MaterialController } from './g.controller';

describe('MaterialController', () => {
  let controller: MaterialController;
  let materialService: { [k: string]: jest.Mock };

  beforeEach(() => {
    materialService = {
      generateMaterial: jest.fn(),
      uploadMaterial: jest.fn(),
      listMaterials: jest.fn(),
      addTag: jest.fn(),
    };
    controller = new MaterialController(materialService as any);
  });

  it('generate 委托 materialService.generateMaterial 并原样返回', async () => {
    const dto = { prompt: 'x' } as any;
    materialService.generateMaterial.mockResolvedValue({ id: 1 });
    await expect(controller.generate(dto)).resolves.toEqual({ id: 1 });
    expect(materialService.generateMaterial).toHaveBeenCalledWith(dto);
  });

  it('upload 透传 dto 与 file 并原样返回', async () => {
    const dto = { url: 'https://x' } as any;
    const file = { originalname: 'a.png' } as any;
    materialService.uploadMaterial.mockResolvedValue({ id: 2 });
    await expect(controller.upload(dto, file)).resolves.toEqual({ id: 2 });
    expect(materialService.uploadMaterial).toHaveBeenCalledWith(dto, file);
  });

  it('upload 无 file 时透传 undefined', async () => {
    const dto = { url: 'https://x' } as any;
    materialService.uploadMaterial.mockResolvedValue({ id: 3 });
    await expect(controller.upload(dto)).resolves.toEqual({ id: 3 });
    expect(materialService.uploadMaterial).toHaveBeenCalledWith(dto, undefined);
  });

  it('list 委托 materialService.listMaterials 并原样返回', async () => {
    const filter = { tag: 't', type: 'video' } as any;
    materialService.listMaterials.mockResolvedValue({ items: [] });
    await expect(controller.list(filter)).resolves.toEqual({ items: [] });
    expect(materialService.listMaterials).toHaveBeenCalledWith(filter);
  });

  it('tag 将 id 转换为 Number 并解构 tags 后调用 addTag', async () => {
    const dto = { tags: ['爆款', '剧情'] } as any;
    materialService.addTag.mockResolvedValue({ id: 4 });
    await expect(controller.tag('4', dto)).resolves.toEqual({ id: 4 });
    expect(materialService.addTag).toHaveBeenCalledWith(4, ['爆款', '剧情']);
  });
});
