import { WorkflowController } from './workflow.controller';
import { of } from 'rxjs';

describe('WorkflowController', () => {
  let controller: WorkflowController;
  let workflowService: { [k: string]: jest.Mock };

  beforeEach(() => {
    workflowService = {
      createDef: jest.fn(),
      listDefs: jest.fn(),
      updateDef: jest.fn(),
      run: jest.fn(),
      streamRun: jest.fn(),
    };
    controller = new WorkflowController(workflowService as any);
  });

  it('createDef 委托 workflowService.createDef 并原样返回', async () => {
    const dto = { name: 'wf' } as any;
    workflowService.createDef.mockResolvedValue({ id: 1 });
    await expect(controller.createDef(dto)).resolves.toEqual({ id: 1 });
    expect(workflowService.createDef).toHaveBeenCalledWith(dto);
  });

  it('listDefs 委托 workflowService.listDefs 并原样返回', async () => {
    const query = { page: 1 } as any;
    workflowService.listDefs.mockResolvedValue({ items: [] });
    await expect(controller.listDefs(query)).resolves.toEqual({ items: [] });
    expect(workflowService.listDefs).toHaveBeenCalledWith(query);
  });

  it('updateDef 将 id 转换为 Number 并原样返回', async () => {
    const dto = { name: 'wf2' } as any;
    workflowService.updateDef.mockResolvedValue({ id: 2 });
    await expect(controller.updateDef('2', dto)).resolves.toEqual({ id: 2 });
    expect(workflowService.updateDef).toHaveBeenCalledWith(2, dto);
  });

  it('run 将 id 转换为 Number 并原样返回', async () => {
    workflowService.run.mockResolvedValue({ runId: 3 });
    await expect(controller.run('3')).resolves.toEqual({ runId: 3 });
    expect(workflowService.run).toHaveBeenCalledWith(3);
  });

  it('streamRun 将 id 转换为 Number 并返回 Observable', () => {
    const obs = of({ data: {} });
    workflowService.streamRun.mockReturnValue(obs);
    expect(controller.streamRun('4')).toBe(obs);
    expect(workflowService.streamRun).toHaveBeenCalledWith(4);
  });
});
