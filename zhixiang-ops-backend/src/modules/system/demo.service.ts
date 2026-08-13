import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { hash } from 'bcryptjs';
import { User } from '../../auth/user.entity';
import { AccountEntity } from '../account/account.entity';
import { TopicEntity } from '../topic/topic.entity';
import { ScriptEntity } from '../script/script.entity';
import { PublishTaskEntity } from '../publish/publish.entity';
import { TopicStatus } from '../topic/topic.types';
import { ScriptStatus } from '../script/script.types';
import { PublishStatus } from '../publish/publish.types';
import { env } from '../../config/env';

/**
 * 演示模式服务（规划「演示帐号 + 演示数据」）。
 * - 演示帐号：复用 admin 帐号（免密登录），不再单独建号（username 全局唯一，避免冲突）。
 * - 演示数据：幂等种子（账号/选题/脚本/发布）到 admin 所属租户，让产品开箱即「看起来有内容」。
 * - 清除：系统初始化（/ops/system/init）时删除演示租户的全部演示业务数据（不删 admin 帐号），
 *   保证正式环境干净。演示数据与正式业务数据同租户隔离仅靠演示种子标记，初始化即清空。
 */
@Injectable()
export class DemoService implements OnModuleInit {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(AccountEntity) private readonly accountRepo: Repository<AccountEntity>,
    @InjectRepository(TopicEntity) private readonly topicRepo: Repository<TopicEntity>,
    @InjectRepository(ScriptEntity) private readonly scriptRepo: Repository<ScriptEntity>,
    @InjectRepository(PublishTaskEntity)
    private readonly publishRepo: Repository<PublishTaskEntity>,
  ) {}

  /** 启动钩子：演示模式开启时自动幂等种子演示数据 */
  async onModuleInit(): Promise<void> {
    if (!env.demoMode) return;
    try {
      await this.seedDemo();
      this.logger.log('[demo] 演示数据已就绪');
    } catch (e) {
      this.logger.error('[demo] 演示数据种子失败', (e as Error).stack);
    }
  }

  private attr(tenant: string): string {
    return `attr_${tenant}_content_${randomBytes(16).toString('hex')}`;
  }

  /**
   * 解析演示租户：复用 admin 帐号（username 全局唯一）。
   * - 找到 admin → 返回其所属租户；
   * - 未找到且 createIfMissing → 创建 admin（随机密码，免密登录不参与校验）并返回其租户；
   * - 未找到且不创建 → 返回默认演示租户（env.demoTenant）。
   */
  private async resolveDemoTenant(createIfMissing: boolean): Promise<string> {
    const admin = await this.userRepo.findOne({ where: { username: 'admin' } });
    if (admin) return admin.tenantId;
    if (!createIfMissing) return env.demoTenant;
    const created = this.userRepo.create({
      username: 'admin',
      password: await hash(randomBytes(16).toString('hex'), 10),
      realName: '演示管理员',
      role: 'admin',
      tenantId: env.demoTenant,
      type: 'standalone',
      status: 1,
    });
    await this.userRepo.save(created);
    return created.tenantId;
  }

  /** 确保演示管理员存在（演示登录兜底；复用 admin 帐号） */
  async ensureDemoUser(): Promise<User> {
    await this.resolveDemoTenant(true); // 确保 admin 帐号存在
    const user = await this.userRepo.findOne({ where: { username: 'admin' } });
    if (!user) throw new Error('[demo] admin 帐号缺失，演示登录失败');
    return user;
  }

  /** 幂等种子：演示标记账号（demo_douyin_001）已存在则跳过，避免被既有数据阻塞或重复注入 */
  async seedDemo(): Promise<void> {
    const tenant = await this.resolveDemoTenant(true);
    const existing = await this.accountRepo.findOne({
      where: { tenantId: tenant, platformAccountId: 'demo_douyin_001' },
    });
    if (existing) return;

    // ── 账号矩阵（5 个多平台账号） ──
    const accounts = await this.accountRepo.save(
      this.accountRepo.create([
        {
          tenantId: tenant,
          platform: 'douyin',
          platformAccountId: 'demo_douyin_001',
          nickname: '智享生活旗舰',
          identity: 'primary',
          track: '生活好物',
          stage: 'mature',
          status: 'normal',
          fansCount: 1280000,
          followCount: 320,
          likeCount: 9800000,
          lastActiveAt: new Date(Date.now() - 2 * 3600 * 1000),
          remark: '演示账号·主号',
        },
        {
          tenantId: tenant,
          platform: 'kuaishou',
          platformAccountId: 'demo_kuaishou_001',
          nickname: '老铁严选',
          identity: 'secondary',
          track: '直播带货',
          stage: 'growing',
          status: 'normal',
          fansCount: 540000,
          followCount: 180,
          likeCount: 3200000,
          lastActiveAt: new Date(Date.now() - 26 * 3600 * 1000),
          remark: '演示账号·副号',
        },
        {
          tenantId: tenant,
          platform: 'xiaohongshu',
          platformAccountId: 'demo_xhs_001',
          nickname: '种草研究所',
          identity: 'matrix',
          track: '美妆护肤',
          stage: 'growing',
          status: 'warning',
          fansCount: 230000,
          followCount: 540,
          likeCount: 1500000,
          lastActiveAt: new Date(Date.now() - 50 * 3600 * 1000),
          remark: '演示账号·矩阵号（轻度限流关注）',
        },
        {
          tenantId: tenant,
          platform: 'bilibili',
          platformAccountId: 'demo_bili_001',
          nickname: '硬核测评君',
          identity: 'matrix',
          track: '数码测评',
          stage: 'mature',
          status: 'normal',
          fansCount: 670000,
          followCount: 210,
          likeCount: 5400000,
          lastActiveAt: new Date(Date.now() - 5 * 3600 * 1000),
          remark: '演示账号·矩阵号',
        },
        {
          tenantId: tenant,
          platform: 'wechat-channels',
          platformAccountId: 'demo_wx_001',
          nickname: '智享视频号',
          identity: 'secondary',
          track: '知识分享',
          stage: 'nurturing',
          status: 'unsigned',
          fansCount: 45000,
          followCount: 60,
          likeCount: 230000,
          lastActiveAt: new Date(Date.now() - 72 * 3600 * 1000),
          remark: '演示账号·未授权（待绑定 Token）',
        },
      ]),
    );
    const byPlatform = (p: string) => accounts.find((a) => a.platform === p)!;

    // ── 选题（8 个，覆盖 7 人性 × 6 情绪 代表值） ──
    const topics = await this.topicRepo.save(
      this.topicRepo.create([
        {
          tenantId: tenant,
          attributionId: this.attr(tenant),
          title: '618 前必看：三类人最容易冲动下单的心理陷阱',
          humanDriver: '贪',
          emotion: '好奇',
          formulaTags: ['痛点开场', '数据佐证'],
          status: '' as TopicStatus,
          score: 92,
          promptVersion: 'v1',
          modelUsed: 'glm-4.7-flash',
        },
        {
          tenantId: tenant,
          attributionId: this.attr(tenant),
          title: '懒人收纳：三步搞定换季衣橱的极简方案',
          humanDriver: '懒',
          emotion: '爽感',
          formulaTags: ['场景共鸣', '解决方案'],
          status: '' as TopicStatus,
          score: 84,
          promptVersion: 'v1',
          modelUsed: 'glm-4.7-flash',
        },
        {
          tenantId: tenant,
          attributionId: this.attr(tenant),
          title: '孩子上网课视力告急？家长最该担心的三件事',
          humanDriver: '怕',
          emotion: '焦虑',
          formulaTags: ['共情', '权威背书'],
          status: '' as TopicStatus,
          score: 88,
          promptVersion: 'v1',
          modelUsed: 'glm-4.7-flash',
        },
        {
          tenantId: tenant,
          attributionId: this.attr(tenant),
          title: '普通人也能轻松拥有的轻奢感，真的不是智商税',
          humanDriver: '虚荣',
          emotion: '感动',
          formulaTags: ['身份认同', '对比测评'],
          status: '' as TopicStatus,
          score: 79,
          promptVersion: 'v1',
          modelUsed: 'glm-4.7-flash',
        },
        {
          tenantId: tenant,
          attributionId: this.attr(tenant),
          title: '幕后揭秘：那些爆款视频到底是怎么拍出来的',
          humanDriver: '窥探',
          emotion: '好奇',
          formulaTags: ['设疑', '反转'],
          status: '' as TopicStatus,
          score: 81,
          promptVersion: 'v1',
          modelUsed: 'glm-4.7-flash',
        },
        {
          tenantId: tenant,
          attributionId: this.attr(tenant),
          title: '一个人住的第 365 天，我学会了和孤独和解',
          humanDriver: '孤独爱',
          emotion: '共鸣',
          formulaTags: ['故事引入', '情绪峰值'],
          status: '' as TopicStatus,
          score: 73,
          promptVersion: 'v1',
          modelUsed: 'glm-4.7-flash',
        },
        {
          tenantId: tenant,
          attributionId: this.attr(tenant),
          title: '凭什么同样的工作量，有人却拿不到该有的回报',
          humanDriver: '愤怒不公',
          emotion: '愤怒',
          formulaTags: ['对立冲突', '价值升华'],
          status: '' as TopicStatus,
          score: 86,
          promptVersion: 'v1',
          modelUsed: 'glm-4.7-flash',
        },
        {
          tenantId: tenant,
          attributionId: this.attr(tenant),
          title: '新手避坑：这五个护肤误区正在毁掉你的脸',
          humanDriver: '怕',
          emotion: '焦虑',
          formulaTags: ['痛点开场', '解决方案'],
          status: '' as TopicStatus,
          score: 41,
          promptVersion: 'v1',
          modelUsed: 'glm-4.7-flash',
        },
      ]),
    );

    // ── 脚本（6 个，关联前 6 个选题，部分已达可发布状态） ──
    const mkScript = (
      topicIdx: number,
      title: string,
      hook: string,
      hookEmotion: string,
      status: string,
    ) => {
      const t = topics[topicIdx];
      return this.scriptRepo.create({
        tenantId: tenant,
        topicId: t.id,
        attributionId: t.attributionId,
        title,
        content: `【${title}】\n钩子：${hook}\n正文：围绕人性「${t.humanDriver}」与情绪「${t.emotion}」展开，先抛痛点引发 ${t.emotion}，再给可落地方案，结尾引导关注与互动。`,
        hook,
        hookEmotion,
        templateId: 'pain-hook',
        version: 1,
        parentVersionId: null,
        status: status as ScriptStatus,
        complianceRisk: { hits: [], level: 'none', checkedAt: new Date().toISOString() },
        promptVersion: 'v1',
        modelUsed: 'glm-4.7-flash',
      });
    };
    const scripts = await this.scriptRepo.save([
      mkScript(
        0,
        '冲动下单心理陷阱·成片脚本',
        '你有没有过：半夜刷到一条视频，醒来发现多了一个快递？',
        '好奇',
        'published',
      ),
      mkScript(
        1,
        '懒人换季收纳·成片脚本',
        '换季最崩溃的不是没衣服，是衣服太多不知道怎么收。',
        '爽感',
        'approved',
      ),
      mkScript(
        2,
        '网课护眼家长必看·成片脚本',
        '孩子视力一年降 100 度，很多家长还蒙在鼓里。',
        '焦虑',
        'approved',
      ),
      mkScript(
        3,
        '轻奢感平替·成片脚本',
        '花小钱也能有高级感，关键不是贵，是选对。',
        '感动',
        'reviewing',
      ),
      mkScript(
        4,
        '爆款视频幕后·成片脚本',
        '你以为的随手一拍，其实是精心设计的 30 秒。',
        '好奇',
        'draft',
      ),
      mkScript(
        5,
        '独居一年·成片脚本',
        '一个人住久了，最怕的不是孤单，是突然的安静。',
        '共鸣',
        'draft',
      ),
    ]);

    // ── 发布任务（8 个，覆盖各状态；已发布带挂车转化漏斗） ──
    const publishedAt = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
    const mkPublish = (
      scriptIdx: number,
      account: AccountEntity,
      status: string,
      opts: Record<string, unknown> = {},
    ) => {
      const s = scripts[scriptIdx];
      return this.publishRepo.create({
        tenantId: tenant,
        scriptId: s.id,
        accountId: account.id,
        platform: account.platform,
        attributionId: s.attributionId,
        videoId: null,
        scheduledAt: null,
        status: status as PublishStatus,
        retryCount: 0,
        errorMsg: null,
        extPostId: null,
        cartProductId: null,
        cartClicks: 0,
        orderConv: 0,
        publishedAt: null,
        ...opts,
      });
    };
    await this.publishRepo.save([
      mkPublish(0, byPlatform('douyin'), 'published', {
        extPostId: `pub_${tenant}_s${scripts[0].id}_douyin`,
        cartProductId: 'demo_product_001',
        cartClicks: 1840,
        orderConv: 96,
        publishedAt: publishedAt(3),
      }),
      mkPublish(0, byPlatform('kuaishou'), 'published', {
        extPostId: `pub_${tenant}_s${scripts[0].id}_kuaishou`,
        cartProductId: 'demo_product_001',
        cartClicks: 920,
        orderConv: 53,
        publishedAt: publishedAt(3),
      }),
      mkPublish(1, byPlatform('xiaohongshu'), 'published', {
        extPostId: `pub_${tenant}_s${scripts[1].id}_xhs`,
        cartProductId: 'demo_product_002',
        cartClicks: 610,
        orderConv: 28,
        publishedAt: publishedAt(1),
      }),
      mkPublish(2, byPlatform('bilibili'), 'published', {
        extPostId: `pub_${tenant}_s${scripts[2].id}_bili`,
        cartProductId: 'demo_product_003',
        cartClicks: 430,
        orderConv: 19,
        publishedAt: publishedAt(5),
      }),
      mkPublish(1, byPlatform('douyin'), 'running', {
        scheduledAt: new Date(Date.now() + 6 * 3600 * 1000),
      }),
      mkPublish(3, byPlatform('kuaishou'), 'queued', {
        scheduledAt: new Date(Date.now() + 24 * 3600 * 1000),
      }),
      mkPublish(4, byPlatform('xiaohongshu'), 'failed', {
        errorMsg: '账号 Token 已过期，请重新授权',
      }),
      mkPublish(5, byPlatform('bilibili'), 'retry', {
        retryCount: 1,
        errorMsg: '平台限流，等待退避重试',
      }),
    ]);
  }

  /**
   * 清除演示租户的全部演示业务数据（系统初始化时调用）。
   * 仅删除业务数据（账号/选题/脚本/发布），不删除 admin 帐号本身。
   * 返回被删除的演示业务行总数。
   */
  async clearDemoData(): Promise<number> {
    const tenant = await this.resolveDemoTenant(false);
    const p = await this.publishRepo.delete({ tenantId: tenant });
    const s = await this.scriptRepo.delete({ tenantId: tenant });
    const tp = await this.topicRepo.delete({ tenantId: tenant });
    const a = await this.accountRepo.delete({ tenantId: tenant });
    const total = (p.affected ?? 0) + (s.affected ?? 0) + (tp.affected ?? 0) + (a.affected ?? 0);
    this.logger.log(`[demo] 已清除演示数据 ${total} 行（租户=${tenant}）`);
    return total;
  }

  /** 是否已存在演示数据（供状态接口提示） */
  async hasDemoData(): Promise<boolean> {
    const tenant = await this.resolveDemoTenant(false);
    const a = await this.accountRepo.findOne({ where: { tenantId: tenant } });
    return !!a;
  }
}
