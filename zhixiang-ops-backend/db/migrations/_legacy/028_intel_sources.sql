-- 028 C 情报采集增强：采集源配置 / 评论审核 / 任务生命周期控制 / 清洗开关
CREATE TABLE IF NOT EXISTS ops_collect_sources (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id         VARCHAR(36)     NOT NULL,
  name              VARCHAR(128)    NOT NULL,
  platform          VARCHAR(32)     NOT NULL,
  source_type       VARCHAR(32)     NOT NULL DEFAULT 'comment',
  target            VARCHAR(512)    NOT NULL,
  mode              VARCHAR(16)     NOT NULL DEFAULT 'web',
  rate_limit        INT             NOT NULL DEFAULT 10,
  cleaning          JSON            NULL,
  config            JSON            NULL,
  enabled           TINYINT(1)      NOT NULL DEFAULT 1,
  last_collected_at DATETIME        NULL,
  collect_count     INT             NOT NULL DEFAULT 0,
  error_msg         TEXT            NULL,
  created_at        DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at        DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at        DATETIME(6)     NULL,
  PRIMARY KEY (id),
  KEY idx_cs_tenant (tenant_id),
  KEY idx_cs_platform (tenant_id, platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采集源配置（公开网页抓取/本地样本）';

ALTER TABLE ops_collected_comments
  ADD COLUMN review_status VARCHAR(16) NOT NULL DEFAULT 'approved' AFTER is_clean;

ALTER TABLE ops_collect_tasks
  ADD COLUMN retry_count INT NOT NULL DEFAULT 0 AFTER collected_count,
  ADD COLUMN source_id  BIGINT UNSIGNED NULL AFTER retry_count,
  ADD COLUMN cleaning   JSON NULL AFTER source_id,
  ADD COLUMN config     JSON NULL AFTER cleaning,
  ADD COLUMN paused_at  DATETIME NULL AFTER config;

ALTER TABLE ops_collected_comments
  ADD KEY idx_cc_review (tenant_id, review_status);