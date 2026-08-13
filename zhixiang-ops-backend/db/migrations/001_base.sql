-- 001 基础表：用户 + 合规 + 技能中心
-- 说明：生产/CI 手工落库参考 SQL（开发期由 TypeORM synchronize 自动建表）
-- 遵循原始表设计（id BIGINT UNSIGNED AUTO_INCREMENT + tenant_id + BaseEntity 三时间戳）

-- 1.A 运营系统本地用户（独立模式登录用）
CREATE TABLE IF NOT EXISTS ops_users (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username  VARCHAR(64)  NOT NULL,
  password  VARCHAR(128) NOT NULL COMMENT 'bcrypt hash',
  real_name VARCHAR(64)  NULL,
  role      VARCHAR(32)  NOT NULL DEFAULT 'admin',
  tenant_id VARCHAR(64)  NOT NULL DEFAULT 't_dev',
  type      VARCHAR(32)  NOT NULL DEFAULT 'standalone',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_username (username),
  KEY idx_user_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='运营系统本地用户';

-- 1.B 合规词库
CREATE TABLE IF NOT EXISTS compliance_words (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id  VARCHAR(36)     NOT NULL,
  word       VARCHAR(64)     NOT NULL,
  category   VARCHAR(32)     NOT NULL DEFAULT 'default',
  level      VARCHAR(16)     NOT NULL DEFAULT 'high',
  action     VARCHAR(16)     NOT NULL DEFAULT 'block',
  enabled    TINYINT(1)      NOT NULL DEFAULT 1,
  created_at DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6)     NULL,
  PRIMARY KEY (id),
  KEY idx_cw_tenant (tenant_id),
  KEY idx_cw_word (tenant_id, word)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合规词库';

-- 1.C 合规日志
CREATE TABLE IF NOT EXISTS compliance_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id  VARCHAR(36)     NOT NULL,
  scene      VARCHAR(32)     NOT NULL DEFAULT 'script',
  source_id  INT             NULL,
  text       TEXT            NULL,
  hits       JSON            NULL,
  level      VARCHAR(16)     NOT NULL DEFAULT 'none',
  score      INT             NOT NULL DEFAULT 0,
  result     VARCHAR(16)     NOT NULL DEFAULT 'pass',
  created_at DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6)     NULL,
  PRIMARY KEY (id),
  KEY idx_cl_tenant (tenant_id),
  KEY idx_cl_scene_source (tenant_id, scene, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合规日志';

-- 1.D 技能市场目录
CREATE TABLE IF NOT EXISTS skills (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id   VARCHAR(36)     NOT NULL COMMENT '固定为 system',
  type        VARCHAR(32)     NOT NULL,
  name        VARCHAR(64)     NOT NULL,
  description VARCHAR(255)    NULL,
  builtin     TINYINT(1)      NOT NULL DEFAULT 1,
  enabled     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at  DATETIME(6)     NULL,
  PRIMARY KEY (id),
  KEY idx_skills_type (tenant_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技能市场目录';

-- 1.E 租户技能安装
CREATE TABLE IF NOT EXISTS skill_installs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id   VARCHAR(36)     NOT NULL,
  skill_id    BIGINT UNSIGNED NOT NULL,
  provider_id BIGINT UNSIGNED NULL,
  enabled     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at  DATETIME(6)     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_skill_install (tenant_id, skill_id),
  KEY idx_si_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户技能安装';

-- 1.F 技能提供者（BYO 绑定）
CREATE TABLE IF NOT EXISTS skill_providers (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id   VARCHAR(36)     NOT NULL,
  skill_type  VARCHAR(32)     NOT NULL,
  provider    VARCHAR(32)     NOT NULL DEFAULT 'local',
  endpoint    VARCHAR(255)    NULL,
  api_key_enc TEXT            NULL,
  enabled     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at  DATETIME(6)     NULL,
  PRIMARY KEY (id),
  KEY idx_sp_tenant_type (tenant_id, skill_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技能提供者（BYO）';
