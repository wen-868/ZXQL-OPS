-- 011 R 商品内容中心
-- 实体：ops_products（商品：source_type/外部商品ID/关联T选品ID/标题/库存/价格/类目/人性驱动）
--       ops_product_contents（AI 内容：标题/卖点/详情/话术/种草/版本/合规风险/状态）
--       ops_product_detail_pages（详情页 sections）
-- 索引、human_driver 映射 D 字典、compliance_risk 联动 P；仅存商品元数据，不含个人信息（合规边界②）

CREATE TABLE IF NOT EXISTS `ops_products` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `source_type` VARCHAR(16) NOT NULL COMMENT 'system/manual/competitor/t_selection',
  `external_product_id` VARCHAR(128) NULL DEFAULT NULL,
  `selection_product_id` INT NULL DEFAULT NULL COMMENT '关联 T 选品（t_selection）',
  `title` VARCHAR(255) NOT NULL,
  `stock` INT NOT NULL DEFAULT 0 COMMENT '库存单一真源（Y 扣减/回写）',
  `price` DECIMAL(12,2) NULL DEFAULT NULL,
  `category` VARCHAR(64) NULL DEFAULT NULL,
  `human_driver` VARCHAR(16) NULL DEFAULT NULL COMMENT '人性驱动（D 字典）',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ops_products_tenant` (`tenant_id`),
  INDEX `idx_ops_products_category` (`category`),
  INDEX `idx_ops_products_selection` (`selection_product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品';

CREATE TABLE IF NOT EXISTS `ops_product_contents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `product_id` INT NOT NULL,
  `human_driver` VARCHAR(16) NULL DEFAULT NULL,
  `title_ai` VARCHAR(255) NULL DEFAULT NULL,
  `selling_point` TEXT NULL DEFAULT NULL,
  `content` JSON NULL DEFAULT NULL,
  `script` TEXT NULL DEFAULT NULL,
  `xhs_copy` TEXT NULL DEFAULT NULL,
  `template_id` VARCHAR(64) NULL DEFAULT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `compliance_risk` VARCHAR(16) NOT NULL DEFAULT 'none',
  `status` VARCHAR(16) NOT NULL DEFAULT 'draft',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ops_product_contents_tenant` (`tenant_id`),
  INDEX `idx_ops_product_contents_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品内容';

CREATE TABLE IF NOT EXISTS `ops_product_detail_pages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `product_id` INT NOT NULL,
  `sections` JSON NULL DEFAULT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ops_product_detail_pages_tenant` (`tenant_id`),
  INDEX `idx_ops_product_detail_pages_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品详情页';
