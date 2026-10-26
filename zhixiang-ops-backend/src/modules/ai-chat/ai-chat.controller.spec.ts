import { AiChatController } from './ai-chat.controller';
import { TenantContext } from '../../tenant/tenant-context';

describe('AiChatController', () => {
  let controller: AiChatController;
  let skillGateway: { [k: string]: jest.Mock };

  beforeEach(() => {
    skillGateway = { generateText: jest.fn() };
    controller = new AiChatController(skillGateway as any);
  });

  it('chat 读取租户上下文，调用 generateText 并返回 { reply }', async () => {
    const dto = { message: '帮我看看今日销量' };
    skillGateway.generateText.mockResolvedValue('今日销量 100 单');
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.chat(dto as any),
    );
    expect(r).toEqual({ reply: '今日销量 100 单' });
    expect(skillGateway.generateText).toHaveBeenCalledWith(
      expect.stringContaining(dto.message),
      'tn-1',
      { maxTokens: 512 },
    );
  });

  it('chat 拼装对话历史并区分用户/助手角色', async () => {
    const dto = {
      message: '再问一句',
      history: [
        { role: 'user', content: '上一条用户问题' },
        { role: 'assistant', content: '上一条助手回答' },
      ],
    };
    skillGateway.generateText.mockResolvedValue('回答');
    const r = await TenantContext.run({ traceId: 't', tenantId: 'tn-1' }, () =>
      controller.chat(dto as any),
    );
    expect(r).toEqual({ reply: '回答' });
    const promptArg = skillGateway.generateText.mock.calls[0][0] as string;
    expect(promptArg).toContain('--- 对话历史 ---');
    expect(promptArg).toContain('用户: 上一条用户问题');
    expect(promptArg).toContain('助手: 上一条助手回答');
    expect(promptArg).toContain('--- 当前问题 ---');
  });
});
