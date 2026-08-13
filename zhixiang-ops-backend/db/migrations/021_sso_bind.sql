-- 021 SSO 对接（统一管理后台与数据互通规则方案 v1.1 §4.2 / §5.2 / §5.3）
-- 角色映射表：管理系统角色 → 运营系统角色 + 菜单范围
CREATE TABLE IF NOT EXISTS `ops_role_bind` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ms_role` VARCHAR(64) NOT NULL COMMENT '管理系统角色码（SUPER_ADMIN/OPERATION_ADMIN/FINANCE_ADMIN/WAREHOUSE_ADMIN）',
  `ops_role` VARCHAR(64) NOT NULL COMMENT '运营系统角色（super_admin/ops_admin/ops_viewer）',
  `menu_scope` VARCHAR(255) NOT NULL DEFAULT 'ops' COMMENT '菜单范围：all/ms/ops/readonly',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_bind_ms_role` (`ms_role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理系统→运营系统角色映射';

-- 租户映射表：管理系统租户 → 运营系统租户
CREATE TABLE IF NOT EXISTS `ops_tenant_bind` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ms_tenant_id` VARCHAR(64) NOT NULL COMMENT '管理系统租户标识',
  `ops_tenant_id` VARCHAR(64) NOT NULL COMMENT '运营系统租户标识',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1=启用 0=停用',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_bind_ms_tenant` (`ms_tenant_id`),
  KEY `idx_tenant_bind_ops_tenant` (`ops_tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理系统↔运营系统租户映射';

-- 角色映射种子（方案 §3.2 角色映射规则）
INSERT IGNORE INTO `ops_role_bind` (`ms_role`, `ops_role`, `menu_scope`) VALUES
('SUPER_ADMIN', 'super_admin', 'all'),
('OPERATION_ADMIN', 'ops_admin', 'ops'),
('FINANCE_ADMIN', 'ops_viewer', 'readonly'),
('WAREHOUSE_ADMIN', 'ops_viewer', 'readonly');

-- 租户映射种子（按实际部署调整：管理系统租户 '1'/'default' → 运营租户 t_dev）
INSERT IGNORE INTO `ops_tenant_bind` (`ms_tenant_id`, `ops_tenant_id`) VALUES
('1', 't_dev'),
('default', 't_dev');
