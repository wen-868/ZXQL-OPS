-- 003 C 情报采集（阶段1 第二步）
CREATE TABLE IF NOT EXISTS ops_collect_tasks (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       VARCHAR(36)     NOT NULL,
  type            VARCHAR(32)     NOT NULL,
  target          VARCHAR(256)    NOT NULL,
  platform        VARCHAR(32)     NOT NULL,
  source_level    VARCHAR(8)      NOT NULL DEFAULT 'L1',
  status          VARCHAR(16)     NOT NULL DEFAULT 'pending',
  progress        INT             NOT NULL DEFAULT 0,
  collected_count INT             NOT NULL DEFAULT 0,
  scope           JSON            NULL,
  fields_collected JSON           NULL,
  error_msg       TEXT            NULL,
  finished_at     DATETIME        NULL,
  created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at      DATETIME(6)     NULL,
  PRIMARY KEY (id),
  KEY idx_ct_tenant (tenant_id),
  KEY idx_ct_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采集任务';

CREATE TABLE IF NOT EXISTS ops_collected_comments (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id     VARCHAR(36)     NOT NULL,
  platform      VARCHAR(32)     NOT NULL,
  source_type   VARCHAR(32)     NOT NULL DEFAULT 'comment',
  source_ref    VARCHAR(256)    NOT NULL,
  content       TEXT            NOT NULL,
  author_id     VARCHAR(128)    NULL,
  likes         INT             NOT NULL DEFAULT 0,
  is_clean      TINYINT(1)      NOT NULL DEFAULT 1,
  clean_result  JSON            NULL,
  content_hash  VARCHAR(64)     NOT NULL,
  collected_at  DATETIME        NOT NULL,
  task_id       VARCHAR(64)     NULL,
  created_at    DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at    DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at    DATETIME(6)     NULL,
  PRIMARY KEY (id),
  KEY idx_cc_tenant (tenant_id),
  KEY idx_cc_hash (tenant_id, content_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采集评论（已脱敏）';

CREATE TABLE IF NOT EXISTS ops_competitors (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id        VARCHAR(36)     NOT NULL,
  platform         VARCHAR(32)     NOT NULL,
  name             VARCHAR(128)    NOT NULL,
  url              VARCHAR(512)    NULL,
  category         VARCHAR(64)     NULL,
  monitor_enabled  TINYINT(1)      NOT NULL DEFAULT 0,
  last_collected_at DATETIME       NULL,
  health_score     INT             NOT NULL DEFAULT 0,
  created_at       DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at       DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at       DATETIME(6)     NULL,
  PRIMARY KEY (id),
  KEY idx_comp_tenant (tenant_id),
  KEY idx_comp_platform (tenant_id, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='竞品监控';

CREATE TABLE IF NOT EXISTS ops_hot_snapshots (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id   VARCHAR(36)     NOT NULL,
  platform    VARCHAR(32)     NOT NULL,
  hot_type    VARCHAR(16)     NOT NULL,
  title       VARCHAR(256)    NOT NULL,
  heat        INT             NOT NULL DEFAULT 0,
  url         VARCHAR(512)    NULL,
  captured_at DATETIME        NOT NULL,
  created_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at  DATETIME(6)     NULL,
  PRIMARY KEY (id),
  KEY idx_hs_tenant (tenant_id),
  KEY idx_hs_captured (tenant_id, captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='热点快照';
