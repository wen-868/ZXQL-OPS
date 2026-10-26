-- 029 自定义看板配置（工作台 dashboard/configs 契约）
-- 每租户可保存多套看板布局（widgets JSON 由前端定义结构）

CREATE TABLE IF NOT EXISTS `ops_dashboard_configs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `name` VARCHAR(64) NOT NULL COMMENT '看板名称',
  `widgets` JSON NOT NULL COMMENT '看板组件布局（前端结构）',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_dash_cfg_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自定义看板配置';
