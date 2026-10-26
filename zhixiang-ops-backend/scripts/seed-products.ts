/**
 * 商品库填充脚本（运营系统产品中心）。
 *
 * 向 ops_products 表批量填充白酒、洋酒、啤酒、主流饮料等商品信息。
 *
 * 运行：cd zhixiang-ops-backend && npx ts-node scripts/seed-products.ts
 * 说明：会在写入前按 tenantId='t_dev' 清空 ops_products 表的既有数据，可重复执行（幂等）。
 */

import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { env } from '../src/config/env';
import { ProductEntity } from '../src/modules/r/product.entity';
import { ProductContentEntity } from '../src/modules/r/product-content.entity';
import { ProductDetailPageEntity } from '../src/modules/r/product-detail-page.entity';
import { ProductService } from '../src/modules/r/product.service';
import { TenantContext } from '../src/tenant/tenant-context';
import { AuditService } from '../src/modules/n/audit.service';
import { AuditLogEntity } from '../src/modules/n/audit-log.entity';

const TENANT = 't_dev';

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
    entities: [ProductEntity],
  });

  await dataSource.initialize();
  console.log(`[seed] 已连接 ${env.DB_NAME} @ ${env.DB_HOST}:${env.DB_PORT}`);

  try {
    // 幂等：先清空 t_dev 既有数据
    const productRepo = dataSource.getRepository(ProductEntity);
    await productRepo.delete({ tenantId: TENANT });
    console.log('[seed] 已清空 ops_products 既有种子数据');

    // 初始化 AuditService（仅记录审计，用同一连接的审计日志仓库）
    const audit = new AuditService(dataSource.getRepository(AuditLogEntity));

    // 初始化 ProductService - 只需要 productRepo 和 audit
    // 其他依赖在 ingest() 中有默认值或不使用
    const productService = new ProductService(
      productRepo,
      productRepo as unknown as Repository<ProductContentEntity>, // contentRepo - simplified
      productRepo as unknown as Repository<ProductDetailPageEntity>, // detailRepo - simplified
      productRepo as never, // selectionRepo - simplified
      { isStandalone: () => true, adapters: { product: { getProduct: async () => {} } } } as never, // integration
      { generateText: async () => 'fallback' } as never, // skill
      audit
    );

    // 商品填充计划：覆盖白酒、洋酒、啤酒、主流饮料
    const productsToFill = [
      // --- 洋酒 (Spirits) ---
      {
        title: '约翰尼·沃克红标威士忌',
        category: '食品',
        price: 49,
        humanDriver: '虚荣',
      },
      {
        title: '杰克丹尼旧标波本威士忌',
        category: '食品',
        price: 59,
        humanDriver: '贪',
      },
      {
        title: '斯米诺伏特加',
        category: '食品',
        price: 45,
        humanDriver: '贪',
      },

      // --- 啤酒 (Beer) ---
      {
        title: '雪花啤酒',
        category: '食品',
        price: 49,
        humanDriver: '贪',
      },
      {
        title: '青岛啤酒',
        category: '食品',
        price: 49,
        humanDriver: '懒',
      },
      {
        title: '海尼根啤酒',
        category: '食品',
        price: 49,
        humanDriver: '愤怒不公',
      },

      // --- 白酒 (Baijiu) ---
      {
        title: '五粮液52度',
        category: '食品',
        price: 199,
        humanDriver: '虚荣',
      },
      {
        title: '牛栏山二锅头',
        category: '食品',
        price: 39,
        humanDriver: '贪',
      },

      // --- 主流饮料 (Mainstream Beverages) ---
      {
        title: '可口可乐',
        category: '食品',
        price: 49,
        humanDriver: '孤独爱',
      },
      {
        title: '雪psi可乐',
        category: '食品',
        price: 49,
        humanDriver: '窥探',
      },
      {
        title: '超大杯 energetice',
        category: '食品',
        price: 49,
        humanDriver: '贪',
      },
      {
        title: '爱尔康矿泉水',
        category: '食品',
        price: 49,
        humanDriver: '怕',
      },
    ];

    console.log(`\n=== 开始填充商品库 (共 ${productsToFill.length} 条） ===\n`);

    for (const p of productsToFill) {
      try {
        await productService.ingest({
          sourceType: 'manual',
          title: p.title,
          category: p.category,
          price: p.price,
          stock: 100,
          humanDriver: p.humanDriver,
        });
        console.log(`✓ 填充成功: ${p.title}`);
      } catch (error: any) {
        console.error(`✗ 填充失败: ${p.title} - ${error.message}`);
      }
    }

    // 验证产品是否创建成功
    const allProducts = await productRepo.find({
      where: { tenantId: TENANT },
      order: { id: 'ASC' },
    });

    console.log(`\n=== 验证结果 ===`);
    console.log(`总商品数: ${allProducts.length}`);
    console.log(`预期数量: ${productsToFill.length}`);

    // 检查分类分布
    const categories = allProducts.map((p) => p.category);
    const uniqueCategories = [...new Set(categories)];
    console.log(`分类分布: ${uniqueCategories.join(', ')}`);

    // 检查人性驱动分布
    const drivers = allProducts
      .map((p) => p.humanDriver)
      .filter(Boolean) as string[];
    const uniqueDrivers = [...new Set(drivers)];
    console.log(`人性驱动分布: ${uniqueDrivers.length} 种`);
    console.log(`  ${uniqueDrivers.join(', ')}`);

    console.log('\n=== 完成 ✅ ===');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('[seed] 失败:', err);
  process.exit(1);
});