-- 008 J 数据监控与回收（阶段1 MVP 最后一环）
-- 说明：开发期由 TypeORM synchronize 自动建表；本文件为变更清单(008)的参考 SQL，
--       用于生产/CI 手工落库或审计。所有表含 tenant_id 多租户隔离列。

-- 回收任务（回收调度与进度）
CREATE TABLE IF NOT EXISTS ops_recycle_tasks (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id         VARCHAR(64)  NOT NULL,
  scope             VARCHAR(16)  NOT NULL COMMENT 'video|account|all',
  target_ref        VARCHAR(128) NOT NULL DEFAULT '' COMMENT '视频 id / 账号 id / 空',
  status            VARCHAR(16)  NOT NULL DEFAULT 'pending' COMMENT 'pending|running|done|failed',
  progress          INT          NOT NULL DEFAULT 0,
  last_collected_at DATETIME     NULL,
  id_legacy         INT          NULL COMMENT '预留',
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at        DATETIME(3)  NULL,
  PRIMARY KEY (id),
  KEY idx_recycle_tenant (tenant_id),
  KEY idx_recycle_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='回收任务';

-- 回收明细（五维四率反馈，仅聚合表现 + 已脱敏评论，无单条个人信息）
CREATE TABLE IF NOT EXISTS ops_feedback (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id     VARCHAR(64)  NOT NULL,
  topic_id      INT          NULL,
  video_id      INT          NULL COMMENT '= I 发布任务 id',
  platform      VARCHAR(32)  NULL,
  attribution_id VARCHAR(64) NOT NULL COMMENT '透传 I（F→I→J 只读）',
  metrics       JSON         NULL COMMENT 'play/completeRate/interact/fanInc/commission',
  comments      JSON         NULL COMMENT '已脱敏回收评论',
  re_analysis_id INT         NULL COMMENT '回流 D 再分析任务 id（闭环）',
  collected_at  DATETIME     NOT NULL,
  id_legacy     INT          NULL COMMENT '预留',
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at    DATETIME(3)  NULL,
  PRIMARY KEY (id),
  KEY idx_feedback_tenant (tenant_id),
  KEY idx_feedback_video (tenant_id, video_id),
  KEY idx_feedback_attr (tenant_id, attribution_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='回收明细';

-- 人性效能（按 人性×情绪 聚合，反哺 E 选题权重）
CREATE TABLE IF NOT EXISTS ops_driver_efficiency (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       VARCHAR(64)  NOT NULL,
  driver          VARCHAR(32)  NOT NULL COMMENT '7 人性之一',
  emotion         VARCHAR(32)  NOT NULL COMMENT '6 情绪之一',
  sample_count    INT          NOT NULL DEFAULT 0,
  avg_play        INT          NOT NULL DEFAULT 0,
  avg_complete_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  avg_interact_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  avg_conversion  DECIMAL(8,4) NOT NULL DEFAULT 0,
  window          VARCHAR(16)  NOT NULL DEFAULT 'day',
  stat_date       DATE         NOT NULL,
  id_legacy       INT          NULL COMMENT '预留',
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at      DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_driver_eff (tenant_id, driver, emotion, window, stat_date),
  KEY idx_driver_eff_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='人性效能';
