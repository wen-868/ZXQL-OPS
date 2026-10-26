-- 015_w_revenue.sql（W 收益与对账）
-- 实体：ops_revenue_records / ops_reconciliation / ops_settlement
-- 统一基类（id/tenant_id/created_at/updated_at/deleted_at 软删）由 BaseEntity 自动带。
-- 合规边界（§11）：收益数据来自平台开放 API/管理系统 Commission 适配层；敏感字段加密；不扩展采集。

CREATE TABLE IF NOT EXISTS `ops_revenue_records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `source` VARCHAR(32) NOT NULL DEFAULT 'commission' COMMENT '收入来源: commission/slot_fee/service_fee/tip/subsidy',
  `platform` VARCHAR(32) NOT NULL COMMENT '平台',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '收入金额',
  `related_order_id` VARCHAR(128) NULL COMMENT '关联订单ID(→Y.orders，Y 未建时可为空)',
  `commission` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '佣金',
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending/settled',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_revenue_tenant_source` (`tenant_id`, `source`),
  KEY `idx_revenue_tenant_platform` (`tenant_id`, `platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收益记录（多收入：佣金/坑位费/服务费/打赏/补贴）';

CREATE TABLE IF NOT EXISTS `ops_reconciliation` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `period` VARCHAR(32) NOT NULL COMMENT '对账周期(YYYY-MM)',
  `order_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '订单/收入总额',
  `commission_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '佣金合计',
  `settled_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已结算合计',
  `diff` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '差额(应收-已结算)',
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending/matched/diff_found',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_reconciliation_tenant_period` (`tenant_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对账（佣金对账/关联 Y 订单）';

CREATE TABLE IF NOT EXISTS `ops_settlement` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `type` VARCHAR(32) NOT NULL DEFAULT 'org_talent_advertiser' COMMENT '分账类型: 机构-达人-投手',
  `parties` JSON NULL COMMENT '分账各方: [{role,name,amount}]',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '分账总额',
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending/settled/invoiced',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_settlement_tenant_type` (`tenant_id`, `type`),
  KEY `idx_settlement_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分账（机构-达人-投手，复用 Commission 适配层）';

-- 由 TypeORM 同步生成（AUTO=True），也可落 `docs/migrations/015_w_revenue.sql` 供 CI/生产显式执行。
