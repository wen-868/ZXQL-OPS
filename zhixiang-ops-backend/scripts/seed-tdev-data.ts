/**
 * t_dev 租户种子数据脚本（运营试运行用）。
 *
 * 覆盖 6 个此前缺业务数据的接口所依赖的底层表：
 *   - 账号对比   → ops_accounts
 *   - 选题效能   → ops_topics（M 聚合）
 *   - 人性钩子   → ops_driver_efficiency（M.getHumanHook 复用 J 人性效能）
 *   - 达人       → ops_talents
 *   - 商单       → ops_brand_orders
 *   - 出海视频   → ops_overseas_videos（+ 关联平台 ops_overseas_platforms）
 *
 * 运行：cd zhixiang-ops-backend && npx ts-node scripts/seed-tdev-data.ts
 * 说明：会在写入前按 tenantId='t_dev' 清空上述表的既有数据，可重复执行（幂等）。
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '../src/config/env';
import { AccountEntity } from '../src/modules/account/account.entity';
import { TalentEntity } from '../src/modules/v/talent.entity';
import { BrandOrderEntity } from '../src/modules/v/brand-order.entity';
import { TopicEntity } from '../src/modules/topic/topic.entity';
import { TopicStatus } from '../src/modules/topic/topic.types';
import { DriverEfficiencyEntity } from '../src/modules/recycle/recycle.entity';
import { OverseasPlatformEntity } from '../src/modules/x/overseas-platform.entity';
import { OverseasVideoEntity } from '../src/modules/x/overseas-video.entity';

const TENANT = 't_dev';

function attrId(): string {
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  return `attr_${TENANT}_content_${hex}`;
}

async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'mysql',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'local',
    synchronize: false,
    entities: [
      AccountEntity,
      TalentEntity,
      BrandOrderEntity,
      TopicEntity,
      DriverEfficiencyEntity,
      OverseasPlatformEntity,
      OverseasVideoEntity,
    ],
  });

  await dataSource.initialize();
  console.log(`[seed] 已连接 ${env.DB_NAME} @ ${env.DB_HOST}:${env.DB_PORT}`);

  try {
    const accountRepo = dataSource.getRepository(AccountEntity);
    const talentRepo = dataSource.getRepository(TalentEntity);
    const orderRepo = dataSource.getRepository(BrandOrderEntity);
    const topicRepo = dataSource.getRepository(TopicEntity);
    const deRepo = dataSource.getRepository(DriverEfficiencyEntity);
    const platformRepo = dataSource.getRepository(OverseasPlatformEntity);
    const videoRepo = dataSource.getRepository(OverseasVideoEntity);

    // 幂等：先清空 t_dev 既有数据（按依赖顺序从子到父）
    await orderRepo.delete({ tenantId: TENANT });
    await videoRepo.delete({ tenantId: TENANT });
    await talentRepo.delete({ tenantId: TENANT });
    await topicRepo.delete({ tenantId: TENANT });
    await deRepo.delete({ tenantId: TENANT });
    await platformRepo.delete({ tenantId: TENANT });
    await accountRepo.delete({ tenantId: TENANT });
    console.log('[seed] 已清空 t_dev 既有种子数据');

    // —— 1. 账号矩阵（账号对比）——
    const accounts = await accountRepo.save([
      accountRepo.create({
        tenantId: TENANT, platform: 'douyin', platformAccountId: 'dy_1001',
        nickname: '美食研究所', identity: 'primary', track: '美食', stage: 'growing',
        status: 'normal', fansCount: 1250000, followCount: 320, likeCount: 9800000,
      }),
      accountRepo.create({
        tenantId: TENANT, platform: 'douyin', platformAccountId: 'dy_1002',
        nickname: '数码玩家', identity: 'secondary', track: '数码', stage: 'mature',
        status: 'normal', fansCount: 860000, followCount: 210, likeCount: 6100000,
      }),
      accountRepo.create({
        tenantId: TENANT, platform: 'kuaishou', platformAccountId: 'ks_2001',
        nickname: '乡村生活录', identity: 'matrix', track: '生活', stage: 'growing',
        status: 'normal', fansCount: 540000, followCount: 180, likeCount: 3200000,
      }),
      accountRepo.create({
        tenantId: TENANT, platform: 'xiaohongshu', platformAccountId: 'xhs_3001',
        nickname: '护肤笔记', identity: 'matrix', track: '美妆', stage: 'growing',
        status: 'warning', fansCount: 320000, followCount: 150, likeCount: 1900000,
      }),
      accountRepo.create({
        tenantId: TENANT, platform: 'bilibili', platformAccountId: 'bili_4001',
        nickname: '硬核拆解', identity: 'secondary', track: '科技', stage: 'mature',
        status: 'normal', fansCount: 710000, followCount: 90, likeCount: 4500000,
      }),
      accountRepo.create({
        tenantId: TENANT, platform: 'wechat-channels', platformAccountId: 'wx_5001',
        nickname: '财经早知道', identity: 'matrix', track: '财经', stage: 'nurturing',
        status: 'unsigned', fansCount: 95000, followCount: 40, likeCount: 410000,
      }),
      accountRepo.create({
        tenantId: TENANT, platform: 'douyin', platformAccountId: 'dy_1003',
        nickname: '萌宠日常', identity: 'matrix', track: '宠物', stage: 'growing',
        status: 'risk', fansCount: 430000, followCount: 130, likeCount: 2600000,
      }),
      accountRepo.create({
        tenantId: TENANT, platform: 'kuaishou', platformAccountId: 'ks_2002',
        nickname: '三农优选', identity: 'matrix', track: '三农', stage: 'mature',
        status: 'normal', fansCount: 680000, followCount: 200, likeCount: 3900000,
      }),
    ]);
    console.log(`[seed] 账号 ${accounts.length} 条`);

    // —— 2. 达人库 ——
    const talents = await talentRepo.save([
      talentRepo.create({
        tenantId: TENANT, name: '小林', type: 'internal', talentAccountId: accounts[0].id,
        agencyShareRate: 10, talentShareRate: 50, status: 'active',
      }),
      talentRepo.create({
        tenantId: TENANT, name: '阿May', type: 'external', talentAccountId: accounts[1].id,
        agencyShareRate: 15, talentShareRate: 55, status: 'active',
      }),
      talentRepo.create({
        tenantId: TENANT, name: '老王', type: 'agency', talentAccountId: accounts[4].id,
        agencyShareRate: 20, talentShareRate: 45, status: 'active',
      }),
      talentRepo.create({
        tenantId: TENANT, name: '小鹿', type: 'internal', talentAccountId: accounts[3].id,
        agencyShareRate: 10, talentShareRate: 50, status: 'active',
      }),
      talentRepo.create({
        tenantId: TENANT, name: '大鱼', type: 'external', talentAccountId: accounts[6].id,
        agencyShareRate: 12, talentShareRate: 53, status: 'inactive',
      }),
    ]);
    console.log(`[seed] 达人 ${talents.length} 条`);

    // —— 3. 商单 ——
    const orders = await orderRepo.save([
      orderRepo.create({
        tenantId: TENANT, advertiser: '某坚果品牌', talentId: talents[0].id,
        accountId: accounts[0].id, amount: 120000, agencyShareRate: 10,
        talentShareRate: 50, status: 'completed', contractNo: 'BO-2026-0001',
      }),
      orderRepo.create({
        tenantId: TENANT, advertiser: '手机厂商X', talentId: talents[1].id,
        accountId: accounts[1].id, amount: 350000, agencyShareRate: 15,
        talentShareRate: 55, status: 'delivering', contractNo: 'BO-2026-0002',
      }),
      orderRepo.create({
        tenantId: TENANT, advertiser: '美妆集团Y', talentId: talents[3].id,
        accountId: accounts[3].id, amount: 88000, agencyShareRate: 10,
        talentShareRate: 50, status: 'signed', contractNo: 'BO-2026-0003',
      }),
      orderRepo.create({
        tenantId: TENANT, advertiser: '农资平台Z', talentId: talents[4].id,
        accountId: accounts[7].id, amount: 60000, agencyShareRate: 12,
        talentShareRate: 53, status: 'negotiating', contractNo: 'BO-2026-0004',
      }),
      orderRepo.create({
        tenantId: TENANT, advertiser: '数码配件商', talentId: talents[2].id,
        accountId: accounts[4].id, amount: 150000, agencyShareRate: 20,
        talentShareRate: 45, status: 'settled', contractNo: 'BO-2026-0005',
      }),
    ]);
    console.log(`[seed] 商单 ${orders.length} 条`);

    // —— 4. 选题（选题效能）——
    const topics = await topicRepo.save([
      topicRepo.create({
        tenantId: TENANT, attributionId: attrId(), title: '99元数码好物开箱',
        humanDriver: '贪', emotion: '好奇', formulaTags: ['开箱', '性价比'],
        status: TopicStatus.Published, score: 82, modelUsed: 'glm-4-flash',
      }),
      topicRepo.create({
        tenantId: TENANT, attributionId: attrId(), title: '明星同款穿搭揭秘',
        humanDriver: '虚荣', emotion: '爽感', formulaTags: ['穿搭', '同款'],
        status: TopicStatus.Published, score: 76, modelUsed: 'glm-4-flash',
      }),
      topicRepo.create({
        tenantId: TENANT, attributionId: attrId(), title: '这些理财坑你踩过吗',
        humanDriver: '怕', emotion: '焦虑', formulaTags: ['理财', '避坑'],
        status: TopicStatus.Written, score: 70, modelUsed: 'glm-4-flash',
      }),
      topicRepo.create({
        tenantId: TENANT, attributionId: attrId(), title: '网红幕后真实生活',
        humanDriver: '窥探', emotion: '好奇', formulaTags: ['幕后', '真实'],
        status: TopicStatus.Published, score: 88, modelUsed: 'glm-4-flash',
      }),
      topicRepo.create({
        tenantId: TENANT, attributionId: attrId(), title: '深夜陪伴治愈系',
        humanDriver: '孤独爱', emotion: '感动', formulaTags: ['治愈', '陪伴'],
        status: TopicStatus.Todo, score: 65, modelUsed: 'glm-4-flash',
      }),
      topicRepo.create({
        tenantId: TENANT, attributionId: attrId(), title: '打工人维权实录',
        humanDriver: '愤怒不公', emotion: '愤怒', formulaTags: ['维权', '实录'],
        status: TopicStatus.Published, score: 91, modelUsed: 'glm-4-flash',
      }),
      topicRepo.create({
        tenantId: TENANT, attributionId: attrId(), title: '一键搞定家务神器',
        humanDriver: '懒', emotion: '爽感', formulaTags: ['神器', '懒人'],
        status: TopicStatus.Shot, score: 74, modelUsed: 'glm-4-flash',
      }),
      topicRepo.create({
        tenantId: TENANT, attributionId: attrId(), title: '双11必买清单',
        humanDriver: '贪', emotion: '爽感', formulaTags: ['清单', '必买'],
        status: TopicStatus.Published, score: 80, modelUsed: 'glm-4-flash',
      }),
    ]);
    console.log(`[seed] 选题 ${topics.length} 条`);

    // —— 5. 人性效能（人性钩子）——
    const statDate = new Date('2026-08-10');
    const deRows = [
      ['贪', '好奇', 42, 156000, 0.38, 0.062, 0.021],
      ['贪', '爽感', 51, 198000, 0.41, 0.071, 0.028],
      ['懒', '爽感', 33, 132000, 0.35, 0.058, 0.019],
      ['怕', '焦虑', 28, 98000, 0.33, 0.049, 0.015],
      ['虚荣', '爽感', 37, 174000, 0.39, 0.066, 0.024],
      ['虚荣', '感动', 19, 86000, 0.31, 0.044, 0.012],
      ['窥探', '好奇', 46, 205000, 0.43, 0.075, 0.026],
      ['孤独爱', '感动', 24, 79000, 0.30, 0.041, 0.011],
      ['愤怒不公', '愤怒', 39, 221000, 0.45, 0.082, 0.031],
      ['愤怒不公', '爽感', 22, 142000, 0.36, 0.060, 0.020],
      ['怕', '好奇', 17, 71000, 0.29, 0.039, 0.010],
      ['懒', '好奇', 15, 64000, 0.28, 0.037, 0.009],
    ].map(([driver, emotion, sampleCount, avgPlay, avgCompleteRate, avgInteractRate, avgConversion]) =>
      deRepo.create({
        tenantId: TENANT, driver: driver as string, emotion: emotion as string,
        sampleCount: sampleCount as number, avgPlay: avgPlay as number,
        avgCompleteRate: avgCompleteRate as number, avgInteractRate: avgInteractRate as number,
        avgConversion: avgConversion as number, window: 'day', statDate,
      }),
    );
    const des = await deRepo.save(deRows);
    console.log(`[seed] 人性效能 ${des.length} 条`);

    // —— 6. 出海平台 + 出海视频 ——
    const platforms = await platformRepo.save([
      platformRepo.create({
        tenantId: TENANT, code: 'tiktok', name: 'TikTok', region: 'global', baseLang: 'en',
      }),
      platformRepo.create({
        tenantId: TENANT, code: 'youtube', name: 'YouTube', region: 'global', baseLang: 'en',
      }),
      platformRepo.create({
        tenantId: TENANT, code: 'instagram', name: 'Instagram', region: 'global', baseLang: 'en',
      }),
    ]);
    console.log(`[seed] 出海平台 ${platforms.length} 条`);

    const videos = await videoRepo.save([
      videoRepo.create({
        tenantId: TENANT, sourceVideoId: 1, platformId: platforms[0].id,
        title: '99 Yuan Gadget Unboxing', targetLang: 'en', status: 'published',
        url: 'https://www.tiktok.com/@sample/video/1',
      }),
      videoRepo.create({
        tenantId: TENANT, sourceVideoId: 2, platformId: platforms[1].id,
        title: 'Celebrity Outfit Reveal', targetLang: 'en', status: 'translating',
      }),
      videoRepo.create({
        tenantId: TENANT, sourceVideoId: 3, platformId: platforms[0].id,
        title: 'Cute Pet Daily Moments', targetLang: 'en', status: 'draft',
      }),
    ]);
    console.log(`[seed] 出海视频 ${videos.length} 条`);

    console.log('[seed] 完成 ✅');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('[seed] 失败:', err);
  process.exit(1);
});
