-- 016 Y 订单与物流中心
-- 运营订单（双源接入：management 管理系统 / platform 平台开放订单；幂等去重：tenant_id + order_id）
CREATE TABLE IF NOT EXISTS ops_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(36) NOT NULL,
  source VARCHAR(16) NOT NULL COMMENT '订单来源: management/platform',
  platform VARCHAR(32) NOT NULL,
  order_id VARCHAR(64) NOT NULL COMMENT '平台/外部订单号(幂等去重键)',
  product_id BIGINT UNSIGNED NULL COMMENT '关联 R 商品(库存单一真源)',
  quantity INT NOT NULL DEFAULT 1,
  amount DECIMAL(12,2) NOT NULL,
  commission DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'pending_payment',
  logistics_status VARCHAR(16) NOT NULL DEFAULT 'pending',
  attribution_id VARCHAR(64) NULL,
  buyer_info TEXT NULL COMMENT '收货信息(AES 加密 JSON)',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_tenant_order (tenant_id, order_id),
  KEY idx_orders_tenant_status (tenant_id, status),
  KEY idx_orders_tenant_platform (tenant_id, platform),
  KEY idx_orders_tenant_product (tenant_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='运营订单';

-- 物流轨迹
CREATE TABLE IF NOT EXISTS ops_logistics_tracks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(36) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL COMMENT '关联 ops_orders.id',
  carrier VARCHAR(32) NOT NULL,
  tracking_no VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  node VARCHAR(255) NOT NULL,
  ts DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_tracks_tenant_order (tenant_id, order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物流轨迹';

-- 电子面单
CREATE TABLE IF NOT EXISTS ops_waybills (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(36) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL COMMENT '关联 ops_orders.id',
  carrier VARCHAR(32) NOT NULL,
  tracking_no VARCHAR(64) NOT NULL,
  print_status VARCHAR(16) NOT NULL DEFAULT 'pending',
  printed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_waybills_tenant_order (tenant_id, order_id),
  KEY idx_waybills_tenant_status (tenant_id, print_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='电子面单';
