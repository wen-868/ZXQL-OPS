import { CollectorGateway } from './collector.gateway';
import { WebCollectorAdapter } from './web-collector.adapter';
import { LocalCollectorAdapter } from './local-collector.adapter';

/** 采集网关路由测试：平台 → 适配器解析 */
describe('CollectorGateway', () => {
  let gw: CollectorGateway;

  beforeEach(() => {
    gw = new CollectorGateway();
  });

  it('local 平台路由到本地样本适配器', () => {
    expect(gw.resolve('local')).toBeInstanceOf(LocalCollectorAdapter);
  });

  it.each(['douyin', 'kuaishou', 'xiaohongshu', 'bilibili', 'wechat-channels', 'weibo', 'web'])(
    '真实平台路由到网页采集适配器: %s',
    (p) => {
      expect(gw.resolve(p)).toBeInstanceOf(WebCollectorAdapter);
    },
  );

  it.each(['unknown', 'tiktok', ''])('未接入平台显式返回未实现适配器: %s', (p) => {
    const adapter = gw.resolve(p);
    expect(adapter).not.toBeInstanceOf(WebCollectorAdapter);
    expect(adapter).not.toBeInstanceOf(LocalCollectorAdapter);
  });

  it('未实现适配器调用时抛出明确错误（不静默产假数据）', async () => {
    const adapter = gw.resolve('tiktok');
    // NotImplementedCollectorAdapter 的三个方法同步抛 NOT_IMPLEMENTED
    expect(() => adapter.fetchComments({ platform: 'tiktok', target: 'x' } as never)).toThrow();
    expect(() => adapter.fetchHot('tiktok', 'video' as never)).toThrow();
    expect(() => adapter.mineKeywords('tiktok', 'kw')).toThrow();
  });
});
