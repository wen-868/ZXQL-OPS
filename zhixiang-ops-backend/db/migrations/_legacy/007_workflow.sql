-- 007 工作流引擎（阶段1 跨模块编排）
CREATE TABLE IF NOT EXISTS ops_workflow_defs (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id  VARCHAR(36)  NOT NULL,
  name       VARCHAR(128) NOT NULL,
  nodes      JSON         NULL COMMENT '节点定义列表',
  edges      JSON         NULL COMMENT '边定义列表',
  `trigger`  VARCHAR(16)  NOT NULL DEFAULT 'manual',
  cron_expr  VARCHAR(64)  NULL,
  enabled    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6)  NULL,
  PRIMARY KEY (id),
  KEY idx_wd_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工作流定义';

CREATE TABLE IF NOT EXISTS ops_workflow_runs (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id   VARCHAR(36)  NOT NULL,
  def_id      INT          NOT NULL,
  status      VARCHAR(16)  NOT NULL DEFAULT 'queued',
  progress    INT          NOT NULL DEFAULT 0,
  started_at  DATETIME     NULL,
  finished_at DATETIME     NULL,
  created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at  DATETIME(6)  NULL,
  PRIMARY KEY (id),
  KEY idx_wr_tenant (tenant_id),
  KEY idx_wr_def (tenant_id, def_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工作流运行';

CREATE TABLE IF NOT EXISTS ops_workflow_run_logs (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id  VARCHAR(36)  NOT NULL,
  run_id     INT          NOT NULL,
  node_id    VARCHAR(64)  NOT NULL,
  node_type  VARCHAR(16)  NOT NULL,
  status     VARCHAR(16)  NOT NULL DEFAULT 'running',
  input      JSON         NULL,
  output     JSON         NULL,
  trace_id   VARCHAR(64)  NULL,
  created_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6)  NULL,
  PRIMARY KEY (id),
  KEY idx_wrl_tenant (tenant_id),
  KEY idx_wrl_run (tenant_id, run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工作流运行日志';
