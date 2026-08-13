-- 010 T 选品中心（规划 T 选品中心）
-- 选品库 + 选品清单；按 tenant_id 强隔离；human_driver 映射 D 字典（选品→内容 R 联动）
-- 由 TypeORM 同步生成（AUTO=True），也可落本文件供 CI/生产显式执行。

CREATE TABLE ops_selection_products (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id           VARCHAR(64)  NOT NULL,
  source              VARCHAR(32)  NOT NULL COMMENT 'platform(平台开放API)/manual(手动录入)/system(管理系统)',
  platform            VARCHAR(32)  NULL,
  external_product_id VARCHAR(128) NULL,
  title               VARCHAR(255) NOT NULL,
  commission_rate     DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '佣金率百分比',
  reputation_score    DECIMAL(3,2) NULL          COMMENT '口碑分(>=4.6 优)',
  sales_30d           INT          NOT NULL DEFAULT 0 COMMENT '近30天销量',
  price               DECIMAL(12,2) NULL,
  category            VARCHAR(64)  NULL,
  human_driver        VARCHAR(16)  NULL          COMMENT '人性驱动(映射D字典)',
  metrics             JSON         NULL          COMMENT '扩展指标(销量趋势/评分明细等)',
  collected_at        DATETIME     NULL          COMMENT '采集时间',
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,
  INDEX idx_sp_tenant (tenant_id),
  INDEX idx_sp_platform (platform),
  INDEX idx_sp_external (external_product_id),
  INDEX idx_sp_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ops_selection_lists (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   VARCHAR(64) NOT NULL,
  name        VARCHAR(128) NOT NULL,
  items       JSON        NULL COMMENT '选品ID清单(number[], 指向 ops_selection_products.id)',
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  DATETIME    NULL,
  INDEX idx_sl_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
