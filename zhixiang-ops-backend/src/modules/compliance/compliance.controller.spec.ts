import { ComplianceController } from './compliance.controller';

describe('ComplianceController', () => {
  let controller: ComplianceController;
  let complianceService: { [k: string]: jest.Mock };

  beforeEach(() => {
    complianceService = {
      checkText: jest.fn(),
      listWords: jest.fn(),
      addWord: jest.fn(),
      updateWord: jest.fn(),
      removeWord: jest.fn(),
      getLogs: jest.fn(),
    };
    controller = new ComplianceController(complianceService as any);
  });

  it('checkText 带 scene 时透传 scene 并原样返回', async () => {
    const dto = { text: '内容', scene: 'title' } as any;
    complianceService.checkText.mockResolvedValue({ pass: true });
    await expect(controller.checkText(dto)).resolves.toEqual({ pass: true });
    expect(complianceService.checkText).toHaveBeenCalledWith('内容', 'title');
  });

  it('checkText 不带 scene 时默认 script', async () => {
    const dto = { text: '内容' } as any;
    complianceService.checkText.mockResolvedValue({ pass: true });
    await expect(controller.checkText(dto)).resolves.toEqual({ pass: true });
    expect(complianceService.checkText).toHaveBeenCalledWith('内容', 'script');
  });

  it('listWords 委托 complianceService.listWords 并原样返回', async () => {
    const q = { keyword: 'x' } as any;
    complianceService.listWords.mockResolvedValue({ items: [] });
    await expect(controller.listWords(q)).resolves.toEqual({ items: [] });
    expect(complianceService.listWords).toHaveBeenCalledWith(q);
  });

  it('addWord 委托 complianceService.addWord 并原样返回', async () => {
    const dto = { word: '敏感' } as any;
    complianceService.addWord.mockResolvedValue({ id: 1 });
    await expect(controller.addWord(dto)).resolves.toEqual({ id: 1 });
    expect(complianceService.addWord).toHaveBeenCalledWith(dto);
  });

  it('updateWord 将 id 转换为 Number 并原样返回', async () => {
    const dto = { word: '新' } as any;
    complianceService.updateWord.mockResolvedValue({ id: 3 });
    await expect(controller.updateWord('3', dto)).resolves.toEqual({ id: 3 });
    expect(complianceService.updateWord).toHaveBeenCalledWith(3, dto);
  });

  it('removeWord 将 id 转换为 Number 并原样返回', async () => {
    complianceService.removeWord.mockResolvedValue({ removed: true });
    await expect(controller.removeWord('4')).resolves.toEqual({ removed: true });
    expect(complianceService.removeWord).toHaveBeenCalledWith(4);
  });

  it('getLogs 委托 complianceService.getLogs 并原样返回', async () => {
    const q = { page: 1 } as any;
    complianceService.getLogs.mockResolvedValue({ items: [] });
    await expect(controller.getLogs(q)).resolves.toEqual({ items: [] });
    expect(complianceService.getLogs).toHaveBeenCalledWith(q);
  });
});
