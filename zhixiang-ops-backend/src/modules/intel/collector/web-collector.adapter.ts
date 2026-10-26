import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';
import { CollectorAdapter, RawComment, RawHot } from './collector.adapter';
import { CollectTaskEntity } from '../collect-task.entity';
import { HotType } from '../intel.types';

/**
 * 公开网页抓取适配器（真实采集通道）。
 * 抓取公开页面 HTML（静态/SSR 页面可提取正文；JS 渲染页面尽力而为），
 * 提取 title / meta / 正文段落 / 评论类元素 为结构化 RawComment。
 * 合规：仅公开页面内容；不抓取需登录/授权数据；命中隐私由上游清洗管线剥离。
 * 控制：超时 / UA / 最大体积 / 失败重试（指数退避）；限频由上游令牌桶按 tenant+platform 执行。
 */

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_BYTES = 1024 * 1024; // 单页最大抓取 1MB
const MAX_RETRIES = 2;

/** 平台公开搜索页模板（关键词型任务拼 URL 后按公开页抓取） */
const SEARCH_URL_TEMPLATES: Record<string, string> = {
  bilibili: 'https://www.bilibili.com/search?keyword={kw}',
  douyin: 'https://www.douyin.com/search/{kw}',
  xiaohongshu: 'https://www.xiaohongshu.com/search_result?keyword={kw}',
  kuaishou: 'https://www.kuaishou.com/search/video?searchKey={kw}',
  'wechat-channels': 'https://weixin.sogou.com/weixin?type=2&query={kw}',
  web: 'https://www.baidu.com/s?wd={kw}',
};

/** 平台公开热点页 */
const HOT_URLS: Record<string, string> = {
  bilibili: 'https://www.bilibili.com/v/popular/all',
  web: 'https://tophub.today/',
};

/** 抓取一次 URL，返回 HTML 文本；失败抛出可读错误 */
export function fetchUrl(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? httpsGet : httpGet;
    const req = client(
      url,
      {
        headers: {
          'user-agent': DEFAULT_UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'zh-CN,zh;q=0.9',
          ...(opts.headers ?? {}),
        },
        timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 400) {
          res.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new Error('页面超过 1MB 限制'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('抓取超时')));
    req.on('error', reject);
  });
}

/** 从 HTML 提取正文文本块（去除 script/style/标签），供清洗管线使用 */
export function extractHtmlText(html: string): string[] {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const text = withoutScripts
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 8 && s.length <= 500);
}

/** 提取页面标题（title / og:title / h1 兜底） */
export function extractTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return og[1].trim();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return title[1].replace(/<[^>]+>/g, '').trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, '').trim();
  return '';
}

/** 评论类元素粗提取：class/data 含 comment 的块（尽力而为，JS 渲染页面通常取不到） */
export function extractCommentBlocks(html: string): string[] {
  const blocks: string[] = [];
  const pattern =
    /<(?:div|li|section|article)[^>]*(?:class|data-[a-z-]+)=["'][^"']*(?:comment|reply|danmaku|评论)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|li|section|article)>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const inner = m[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (inner.length >= 8 && inner.length <= 500) blocks.push(inner);
    if (blocks.length >= 50) break;
  }
  return blocks;
}

/** 把任务 target 解析为可抓取 URL：URL 直接使用；关键词按平台搜索页模板 */
function resolveUrl(target: string, platform: string): string {
  const t = target.trim();
  if (/^https?:\/\//i.test(t)) return t;
  const tmpl = SEARCH_URL_TEMPLATES[platform] ?? SEARCH_URL_TEMPLATES.web;
  return tmpl.replace('{kw}', encodeURIComponent(t));
}

/** 链接标题热点上限 */
const MAX_HOT_LINKS = 20;

/** 链接文本归一：去标签 + 压空白 */
function linkText(inner: string): string {
  return inner
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 热点链接转绝对地址（相对地址按页面 URL 解析） */
function absoluteUrl(href: string, baseUrl: string): string {
  return /^https?:\/\//i.test(href) ? href : new URL(href, baseUrl).toString();
}

/**
 * 提取页面所有链接标题（<a> 文本），作为热点候选（去重，上限 MAX_HOT_LINKS）。
 */
function collectHotLinks(html: string, baseUrl: string, hotType: HotType): RawHot[] {
  const items: RawHot[] = [];
  const seen = new Set<string>();
  // 每次调用新建正则：/g 正则带 lastIndex 状态，不可跨调用复用
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const text = linkText(m[2]);
    if (text.length < 6 || text.length > 60 || seen.has(text)) continue;
    seen.add(text);
    items.push({
      hotType,
      title: text,
      heat: 0,
      url: absoluteUrl(m[1], baseUrl),
    });
    if (items.length >= MAX_HOT_LINKS) break;
  }
  return items;
}

export class WebCollectorAdapter implements CollectorAdapter {
  /**
   * 网络函数可注入（单元测试替换为桩）；生产默认用真实 fetchUrl。
   */
  constructor(private readonly fetcher: typeof fetchUrl = fetchUrl) {}

  async fetchComments(task: CollectTaskEntity): Promise<RawComment[]> {
    const config = task.config ?? {};
    const url = resolveUrl(task.target, task.platform);
    let html = '';
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        html = await this.fetcher(url, {
          timeoutMs: (config.timeoutMs as number) ?? DEFAULT_TIMEOUT_MS,
          headers: config.headers as Record<string, string> | undefined,
        });
        break;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
    if (!html) {
      throw new Error(
        `抓取失败: ${url}（${lastErr instanceof Error ? lastErr.message : String(lastErr)}）`,
      );
    }

    const title = extractTitle(html);
    const titleBlocks: RawComment[] = [];
    if (title.length >= 8) {
      titleBlocks.push({
        sourceRef: url,
        content: title,
        authorId: 'page',
        likes: 0,
        collectedAt: new Date(),
      });
    }
    // 正文/评论元素 → 结构化条目（content 为提取文本）
    const textBlocks: RawComment[] = [...extractHtmlText(html), ...extractCommentBlocks(html)].map(
      (text) => ({
        sourceRef: url,
        content: text,
        authorId: 'page',
        likes: 0,
        collectedAt: new Date(),
      }),
    );
    const merged = [...titleBlocks, ...textBlocks];
    // 去重（同文本只保留一次）
    const seen = new Set<string>();
    return merged
      .filter((r) => {
        if (seen.has(r.content)) return false;
        seen.add(r.content);
        return true;
      })
      .map((r, i) => ({
        ...r,
        sourceRef: `${url}#${i}`,
      }));
  }

  async fetchHot(platform: string, hotType: HotType): Promise<RawHot[]> {
    const url = HOT_URLS[platform] ?? HOT_URLS.web;
    let html = '';
    try {
      html = await this.fetcher(url);
    } catch {
      return [];
    }
    return collectHotLinks(html, url, hotType);
  }

  mineKeywords(platform: string, target: string): Promise<string[]> {
    void platform;
    return Promise.resolve([
      `${target}测评`,
      `${target}平替`,
      `${target}攻略`,
      `${target}红黑榜`,
      `${target}避坑`,
    ]);
  }
}
