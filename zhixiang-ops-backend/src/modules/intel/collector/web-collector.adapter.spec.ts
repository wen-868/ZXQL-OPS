import {
  extractHtmlText,
  extractTitle,
  extractCommentBlocks,
  WebCollectorAdapter,
} from './web-collector.adapter';
import { CollectTaskEntity } from '../collect-task.entity';
import { CollectTaskStatus, HotType } from '../intel.types';

/**
 * WebCollectorAdapter 纯函数 + 组合逻辑测试（规划 §4-C 真实采集通道）。
 * 纯函数（extractTitle/extractHtmlText/extractCommentBlocks）不发起网络；
 * fetchComments/fetchHot 通过构造器注入 fetchUrl 桩（真实抓取由 E2E 覆盖），
 * 这里验证 HTML → 结构化结果的解析组合正确。
 */

let adapter: WebCollectorAdapter;
let mockFetch: jest.Mock<Promise<string>, [string, unknown?]>;

beforeEach(() => {
  mockFetch = jest.fn<Promise<string>, [string, unknown?]>();
  adapter = new WebCollectorAdapter(mockFetch);
});

describe('extractTitle', () => {
  it('og:title 优先', () => {
    const html =
      '<html><head><title>错误标题</title><meta property="og:title" content="正确标题"></head></html>';
    expect(extractTitle(html)).toBe('正确标题');
  });

  it('无 og:title 时回退 title 标签', () => {
    expect(extractTitle('<html><head><title>页面标题</title></head></html>')).toBe('页面标题');
  });

  it('title 为空时回退 h1', () => {
    expect(extractTitle('<html><body><h1>H1 标题</h1></body></html>')).toBe('H1 标题');
  });

  it('什么都没有 → 空串', () => {
    expect(extractTitle('<html></html>')).toBe('');
  });
});

describe('extractHtmlText', () => {
  it('去除 script/style/注释/标签，按段落切块，保留中文', () => {
    const html = `
      <html><body>
        <script>var x = 'should not appear';</script>
        <style>.cls { color: red; }</style>
        <!-- 注释也不出现 -->
        <p>第一段正文内容足够长可以保留</p>
        <div>第二段正文内容同样足够长可以保留</div>
      </body></html>`;
    const blocks = extractHtmlText(html);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks.some((b) => b.includes('第一段正文'))).toBe(true);
    expect(blocks.some((b) => b.includes('script'))).toBe(false);
    expect(blocks.some((b) => b.includes('should not appear'))).toBe(false);
  });

  it('HTML 实体解码（&nbsp;/&amp;）', () => {
    const html = '<p>价格&nbsp;100 元 &amp; 优惠</p>';
    const blocks = extractHtmlText(html);
    expect(blocks[0]).toContain('价格 100 元 & 优惠');
  });

  it('过滤过短（<8 字）与过长（>500 字）碎片', () => {
    const html = '<p>短</p><div>短</div>';
    expect(extractHtmlText(html)).toEqual([]);
    expect(extractHtmlText('<p>' + '长'.repeat(600) + '</p>')).toEqual([]);
  });
});

describe('extractCommentBlocks', () => {
  it('提取 class 含 comment/reply/评论 的块，最多 50 条', () => {
    const html = Array.from({ length: 60 }, (_, i) => {
      const cls = i % 2 === 0 ? 'comment-item' : 'reply-item';
      return `<div class="${cls}">第${i}条评论内容足够长可以保留</div>`;
    }).join('');
    const blocks = extractCommentBlocks(html);
    expect(blocks.length).toBe(50);
    expect(blocks[0]).toContain('第0条');
  });
});

describe('WebCollectorAdapter.fetchComments 解析组合', () => {
  it('抓取失败（连续重试后仍失败）→ 抛含 URL 的错误', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));
    jest
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: () => void) => fn()) as typeof setTimeout);
    const task = {
      id: 1,
      tenantId: 't',
      platform: 'douyin',
      target: 'https://127.0.0.1:1/never',
      status: CollectTaskStatus.Pending,
      config: { timeoutMs: 50 },
    } as unknown as CollectTaskEntity;

    await expect(adapter.fetchComments(task)).rejects.toThrow(/抓取失败.*ECONNREFUSED/);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    (jest.spyOn(global, 'setTimeout') as jest.Mock).mockRestore();
  });

  it('title ≥8 字进入结果，正文块进入结果，sourceRef 带 #序号', async () => {
    mockFetch.mockResolvedValueOnce(`
      <html><head><title>某某品牌的年度测评大合集</title></head>
      <body>
        <p>这一段是页面正文内容，长度足够，应该被保留下来</p>
        <div class="comment-item">这条用户评论观点鲜明值得保留</div>
      </body></html>`);
    const raw = await adapter.fetchComments({
      id: 2,
      tenantId: 't',
      platform: 'bilibili',
      target: 'https://example.com/article',
      status: CollectTaskStatus.Pending,
    } as unknown as CollectTaskEntity);

    expect(raw.length).toBeGreaterThanOrEqual(3);
    expect(raw.some((r) => r.content.includes('年度测评'))).toBe(true);
    expect(raw.some((r) => r.content.includes('页面正文'))).toBe(true);
    expect(raw.some((r) => r.content.includes('用户评论'))).toBe(true);
    for (const r of raw) {
      expect(r.sourceRef).toMatch(/^https:\/\/example\.com\/article#\d+$/);
      expect(r.authorId).toBe('page');
    }
  });

  it('短标题（<8 字）不进结果；重复内容只保留一次', async () => {
    mockFetch.mockResolvedValueOnce(`<html><head><title>短标题</title></head>
      <body><p>同样的段落内容出现两次同样的段落内容出现两次</p></body></html>`);
    const raw = await adapter.fetchComments({
      id: 3,
      tenantId: 't',
      platform: 'web',
      target: 'https://example.com/x',
      status: CollectTaskStatus.Pending,
    } as unknown as CollectTaskEntity);

    expect(raw.some((r) => r.content === '短标题')).toBe(false);
    const contents = raw.map((r) => r.content);
    expect(new Set(contents).size).toBe(contents.length);
  });
});

describe('WebCollectorAdapter.fetchHot 解析组合', () => {
  it('链接文本 6-60 字作为热点标题，绝对/相对 URL 均归一化', async () => {
    mockFetch.mockResolvedValueOnce(`
      <html><body>
        <a href="https://example.com/a">足够长的热点标题一</a>
        <a href="/b">足够长的热点标题二</a>
        <a href="/c">短</a>
        <a href="/d">这一条太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长太长</a>
      </body></html>`);
    const items = await adapter.fetchHot('web', HotType.Topic);
    expect(items.length).toBe(2);
    expect(items[0].title).toBe('足够长的热点标题一');
    expect(items[1].url).toMatch(/^https:\/\/tophub\.today\/b$/);
  });
});
