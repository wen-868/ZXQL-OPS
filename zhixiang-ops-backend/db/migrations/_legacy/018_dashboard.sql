-- 018 M 决策仪表盘与 BI（规划 M：阶段2 商业化收口 / Should 级 BI 聚合层）
-- 仪表盘配置（widgets 存组件配置 JSON）

CREATE TABLE IF NOT EXISTS `ops_dashboards` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(128) NOT NULL COMMENT '仪表盘名称',
  `widgets` JSON NULL COMMENT '组件配置数组 [{type,title,props}]',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_dashboards_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='仪表盘配置';

-- 注：M 其余看板（overview/funnel/account-compare/topic-efficiency/human-hook）
-- 均为跨域聚合查询，复用 J(ops_feedback/ops_driver_efficiency) 与各域实体，
-- 不新增业务表；tenant_id 强隔离。

-- 实际迁移脚本位置：zhixiang-ops-backend/db/migrations/018_dashboard.sql（与既有 db/migrations/ 系列一致）；由 TypeORM 同步生成（AUTO=True）。
