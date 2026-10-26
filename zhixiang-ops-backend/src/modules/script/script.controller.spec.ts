import { ScriptController } from './script.controller';

describe('ScriptController', () => {
  let controller: ScriptController;
  let scriptService: { [k: string]: jest.Mock };

  beforeEach(() => {
    scriptService = {
      generateScript: jest.fn(),
      listScripts: jest.fn(),
      getScript: jest.fn(),
      updateScript: jest.fn(),
      checkCompliance: jest.fn(),
      versionScript: jest.fn(),
      listTemplates: jest.fn(),
    };
    controller = new ScriptController(scriptService as any);
  });

  it('generateScript 委托 scriptService.generateScript 并原样返回', async () => {
    const dto = { topic: 'x' } as any;
    scriptService.generateScript.mockResolvedValue({ id: 1 });
    await expect(controller.generateScript(dto)).resolves.toEqual({ id: 1 });
    expect(scriptService.generateScript).toHaveBeenCalledWith(dto);
  });

  it('listScripts 委托 scriptService.listScripts 并原样返回', async () => {
    const query = { page: 1 } as any;
    scriptService.listScripts.mockResolvedValue({ items: [] });
    await expect(controller.listScripts(query)).resolves.toEqual({ items: [] });
    expect(scriptService.listScripts).toHaveBeenCalledWith(query);
  });

  it('getScript 将 id 转换为 Number 并原样返回', async () => {
    scriptService.getScript.mockResolvedValue({ id: 2 });
    await expect(controller.getScript('2')).resolves.toEqual({ id: 2 });
    expect(scriptService.getScript).toHaveBeenCalledWith(2);
  });

  it('updateScript 将 id 转换为 Number 并原样返回', async () => {
    const dto = { content: 'c' } as any;
    scriptService.updateScript.mockResolvedValue({ id: 3 });
    await expect(controller.updateScript('3', dto)).resolves.toEqual({ id: 3 });
    expect(scriptService.updateScript).toHaveBeenCalledWith(3, dto);
  });

  it('checkCompliance 将 id 转换为 Number 并原样返回', async () => {
    const dto = { scene: 'script' } as any;
    scriptService.checkCompliance.mockResolvedValue({ pass: true });
    await expect(controller.checkCompliance('4', dto)).resolves.toEqual({ pass: true });
    expect(scriptService.checkCompliance).toHaveBeenCalledWith(4, dto);
  });

  it('versionScript 将 id 转换为 Number 并原样返回', async () => {
    const dto = { note: 'v2' } as any;
    scriptService.versionScript.mockResolvedValue({ version: 2 });
    await expect(controller.versionScript('5', dto)).resolves.toEqual({ version: 2 });
    expect(scriptService.versionScript).toHaveBeenCalledWith(5, dto);
  });

  it('listTemplates 委托 scriptService.listTemplates 并原样返回', async () => {
    scriptService.listTemplates.mockResolvedValue([{ id: 1 }]);
    await expect(controller.listTemplates()).resolves.toEqual([{ id: 1 }]);
    expect(scriptService.listTemplates).toHaveBeenCalledWith();
  });
});
