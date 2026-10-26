-- 009 N 团队与权限（RBAC 角色/权限 + 操作审计）
-- 对齐开发顺序设计.md「N 团队与权限」详细设计：
--   ops_roles / ops_role_user / ops_audit_logs，全部按 tenant_id 强隔离。

CREATE TABLE IF NOT EXISTS `ops_roles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `permissions` JSON NOT NULL COMMENT '权限点集合（string[]，如 ["account:read","role:manage"]）',
  `is_system` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '系统内置角色（不可删）',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_roles_tenant` (`tenant_id`),
  UNIQUE KEY `uniq_roles_tenant_name` (`tenant_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色（RBAC）';

CREATE TABLE IF NOT EXISTS `ops_role_user` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID（管理系统 SSO 透传，运营系统不持有用户表）',
  `role_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_role_user` (`tenant_id`, `user_id`, `role_id`),
  KEY `idx_role_user_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户-角色绑定（RBAC 多对多）';

CREATE TABLE IF NOT EXISTS `ops_audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `user_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '操作者用户ID',
  `action` VARCHAR(64) NOT NULL COMMENT '操作类型，如 create_role / assign_role',
  `module` VARCHAR(32) NOT NULL COMMENT '所属模块，如 role / audit / account',
  `resource` VARCHAR(128) DEFAULT NULL COMMENT '操作对象标识，如 roleId:12',
  `trace_id` VARCHAR(64) DEFAULT NULL COMMENT '链路追踪号',
  `ts` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_tenant` (`tenant_id`),
  KEY `idx_audit_tenant_ts` (`tenant_id`, `ts`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作审计日志';
