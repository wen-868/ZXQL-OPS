import { CustomerController } from './aa.controller';

describe('CustomerController', () => {
  let controller: CustomerController;
  let customerService: { [k: string]: jest.Mock };

  beforeEach(() => {
    customerService = {
      createSession: jest.fn(),
      listSessions: jest.fn(),
      getSession: jest.fn(),
      sendMessage: jest.fn(),
      transfer: jest.fn(),
      listTickets: jest.fn(),
      getTicket: jest.fn(),
      resolveTicket: jest.fn(),
      createKnowledge: jest.fn(),
      listKnowledge: jest.fn(),
      updateKnowledge: jest.fn(),
      deleteKnowledge: jest.fn(),
      getSettings: jest.fn(),
      upsertSettings: jest.fn(),
      syncKnowledgeFromRY: jest.fn(),
    };
    controller = new CustomerController(customerService as any);
  });

  it('createSession 委托 service 并返回信封', async () => {
    const dto = { channel: 'web' };
    customerService.createSession.mockResolvedValue({ id: 1 });
    const r = await controller.createSession(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 1 });
    expect(customerService.createSession).toHaveBeenCalledWith(dto);
  });

  it('listSessions 委托 service 并返回信封', async () => {
    const q = { status: 'open' };
    customerService.listSessions.mockResolvedValue([{ id: 1 }]);
    const r = await controller.listSessions(q as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual([{ id: 1 }]);
    expect(customerService.listSessions).toHaveBeenCalledWith(q);
  });

  it('getSession 委托 service 并返回信封', async () => {
    customerService.getSession.mockResolvedValue({ id: 7 });
    const r = await controller.getSession('7');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 7 });
    expect(customerService.getSession).toHaveBeenCalledWith(7);
  });

  it('sendMessage 委托 service 并返回信封', async () => {
    const dto = { content: 'hi' };
    customerService.sendMessage.mockResolvedValue({ reply: 'hello' });
    const r = await controller.sendMessage('7', dto);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ reply: 'hello' });
    expect(customerService.sendMessage).toHaveBeenCalledWith(7, dto);
  });

  it('transfer 委托 service 并返回信封', async () => {
    const dto = { agentId: 2 };
    customerService.transfer.mockResolvedValue({ transferred: true });
    const r = await controller.transfer('7', dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ transferred: true });
    expect(customerService.transfer).toHaveBeenCalledWith(7, dto);
  });

  it('listTickets 委托 service 并返回信封', async () => {
    const q = { status: 'pending' };
    customerService.listTickets.mockResolvedValue([{ id: 1 }]);
    const r = await controller.listTickets(q as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual([{ id: 1 }]);
    expect(customerService.listTickets).toHaveBeenCalledWith(q);
  });

  it('getTicket 委托 service 并返回信封', async () => {
    customerService.getTicket.mockResolvedValue({ id: 9 });
    const r = await controller.getTicket('9');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 9 });
    expect(customerService.getTicket).toHaveBeenCalledWith(9);
  });

  it('resolveTicket 委托 service 并返回信封', async () => {
    customerService.resolveTicket.mockResolvedValue({ resolved: true });
    const r = await controller.resolveTicket('9');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ resolved: true });
    expect(customerService.resolveTicket).toHaveBeenCalledWith(9);
  });

  it('createKnowledge 委托 service 并返回信封', async () => {
    const dto = { title: 't', content: 'c' };
    customerService.createKnowledge.mockResolvedValue({ id: 3 });
    const r = await controller.createKnowledge(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 3 });
    expect(customerService.createKnowledge).toHaveBeenCalledWith(dto);
  });

  it('listKnowledge 委托 service 并返回信封', async () => {
    customerService.listKnowledge.mockResolvedValue([{ id: 1 }]);
    const r = await controller.listKnowledge('FAQ');
    expect(r.code).toBe('0');
    expect(r.data).toEqual([{ id: 1 }]);
    expect(customerService.listKnowledge).toHaveBeenCalledWith('FAQ');
  });

  it('updateKnowledge 委托 service 并返回信封', async () => {
    const dto = { title: 't2' };
    customerService.updateKnowledge.mockResolvedValue({ id: 3, title: 't2' });
    const r = await controller.updateKnowledge('3', dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 3, title: 't2' });
    expect(customerService.updateKnowledge).toHaveBeenCalledWith(3, dto);
  });

  it('deleteKnowledge 委托 service 并返回信封', async () => {
    customerService.deleteKnowledge.mockResolvedValue({ deleted: true });
    const r = await controller.deleteKnowledge('3');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ deleted: true });
    expect(customerService.deleteKnowledge).toHaveBeenCalledWith(3);
  });

  it('getSettings 委托 service 并返回信封', async () => {
    customerService.getSettings.mockResolvedValue({ autoReply: true });
    const r = await controller.getSettings();
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ autoReply: true });
    expect(customerService.getSettings).toHaveBeenCalledTimes(1);
  });

  it('upsertSettings 委托 service 并返回信封', async () => {
    const dto = { autoReply: false };
    customerService.upsertSettings.mockResolvedValue({ autoReply: false });
    const r = await controller.upsertSettings(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ autoReply: false });
    expect(customerService.upsertSettings).toHaveBeenCalledWith(dto);
  });

  it('syncKnowledge 委托 service 并返回信封', async () => {
    customerService.syncKnowledgeFromRY.mockResolvedValue({ synced: 3 });
    const r = await controller.syncKnowledge();
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ synced: 3 });
    expect(customerService.syncKnowledgeFromRY).toHaveBeenCalledTimes(1);
  });
});
