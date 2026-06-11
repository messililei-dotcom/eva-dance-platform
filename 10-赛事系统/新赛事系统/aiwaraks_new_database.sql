-- AiwaRaks赛事管理平台新数据库草案
-- 目标：先完整承接旧系统所有异构数据，再归并为统一平台入口 + 赛事独立业务域 + 数据融合。

CREATE DATABASE IF NOT EXISTS aiwaraks_events
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE aiwaraks_events;

-- 迁移与治理层：任何旧数据先原样落库，确保可追溯、可重放、可审计。

CREATE TABLE migration_sources (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_code VARCHAR(64) NOT NULL UNIQUE,
  source_name VARCHAR(128) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  file_path VARCHAR(500),
  imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_count BIGINT DEFAULT 0,
  table_count INT DEFAULT 0,
  note VARCHAR(500)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE legacy_raw_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_id BIGINT NOT NULL,
  legacy_table VARCHAR(128) NOT NULL,
  legacy_pk VARCHAR(128),
  raw_json JSON NOT NULL,
  raw_hash CHAR(64),
  imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_legacy_source_table (source_id, legacy_table),
  INDEX idx_legacy_pk (legacy_table, legacy_pk)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE legacy_id_map (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_code VARCHAR(64) NOT NULL,
  legacy_table VARCHAR(128) NOT NULL,
  legacy_id VARCHAR(128) NOT NULL,
  target_table VARCHAR(128) NOT NULL,
  target_id BIGINT NOT NULL,
  confidence DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  match_rule VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_legacy_target (source_code, legacy_table, legacy_id, target_table),
  INDEX idx_target (target_table, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE migration_field_mappings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_code VARCHAR(64) NOT NULL,
  legacy_table VARCHAR(128) NOT NULL,
  legacy_field VARCHAR(128) NOT NULL,
  target_table VARCHAR(128) NOT NULL,
  target_field VARCHAR(128) NOT NULL,
  transform_rule VARCHAR(500),
  required_flag TINYINT(1) NOT NULL DEFAULT 0,
  note VARCHAR(500)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE migration_anomaly_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_code VARCHAR(64) NOT NULL,
  legacy_table VARCHAR(128),
  legacy_pk VARCHAR(128),
  anomaly_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'medium',
  message VARCHAR(1000) NOT NULL,
  raw_json JSON,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  INDEX idx_anomaly_status (status, severity),
  INDEX idx_anomaly_legacy (source_code, legacy_table, legacy_pk)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ops_config_snapshots (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_code VARCHAR(64) NOT NULL,
  config_key VARCHAR(255) NOT NULL,
  config_group VARCHAR(128),
  config_type VARCHAR(32),
  content_masked LONGTEXT,
  sensitive_flag TINYINT(1) NOT NULL DEFAULT 0,
  rotate_required TINYINT(1) NOT NULL DEFAULT 0,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 平台公共层

CREATE TABLE platform_users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  display_name VARCHAR(100),
  nickname VARCHAR(100),
  mobile VARCHAR(32),
  mobile_hash CHAR(64),
  avatar_file_id BIGINT,
  gender TINYINT,
  openid_encrypted VARBINARY(1024),
  unionid_encrypted VARBINARY(1024),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  is_judge TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_mobile_hash (mobile_hash),
  INDEX idx_user_judge (is_judge, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE platform_admin_users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100),
  mobile VARCHAR(32),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  password_reset_required TINYINT(1) NOT NULL DEFAULT 1,
  legacy_user_id VARCHAR(128),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE platform_roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_code VARCHAR(64) NOT NULL UNIQUE,
  role_name VARCHAR(100) NOT NULL,
  scope_type VARCHAR(32) NOT NULL DEFAULT 'platform',
  status VARCHAR(32) NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE platform_permissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  permission_code VARCHAR(128) NOT NULL UNIQUE,
  permission_name VARCHAR(100) NOT NULL,
  module VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE platform_files (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  file_type VARCHAR(32) NOT NULL,
  original_name VARCHAR(255),
  storage_url VARCHAR(1000) NOT NULL,
  storage_provider VARCHAR(64),
  audit_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  uploaded_by BIGINT,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_file_type_status (file_type, audit_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE platform_orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(128) NOT NULL UNIQUE,
  user_id BIGINT,
  business_type VARCHAR(32) NOT NULL,
  business_id BIGINT,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  pay_status VARCHAR(32) NOT NULL DEFAULT 'unpaid',
  paid_at DATETIME,
  legacy_trade_no VARCHAR(128),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_business (business_type, business_id),
  INDEX idx_order_user (user_id, pay_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE platform_regions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  region_code VARCHAR(32) NOT NULL UNIQUE,
  parent_code VARCHAR(32),
  region_name VARCHAR(100) NOT NULL,
  level TINYINT NOT NULL,
  INDEX idx_region_parent (parent_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE platform_operation_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  admin_user_id BIGINT,
  module VARCHAR(64),
  action VARCHAR(128),
  target_type VARCHAR(64),
  target_id BIGINT,
  detail_json JSON,
  operated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_operation_time (operated_at),
  INDEX idx_operation_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 赛事业务层

CREATE TABLE event_competitions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  organizer_admin_id BIGINT,
  start_at DATETIME,
  end_at DATETIME,
  registration_start_at DATETIME,
  registration_end_at DATETIME,
  registration_status VARCHAR(32) NOT NULL DEFAULT 'closed',
  city_code VARCHAR(32),
  venue_name VARCHAR(255),
  contact_phone VARCHAR(255),
  poster_file_id BIGINT,
  intro LONGTEXT,
  base_registration_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  visibility VARCHAR(32) NOT NULL DEFAULT 'public',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_event_time (start_at, end_at),
  INDEX idx_event_status (status, registration_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_groups (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  group_type VARCHAR(64),
  age_group VARCHAR(64),
  competition_mode VARCHAR(64),
  registration_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  scoring_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  scheduled_at DATETIME,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  INDEX idx_group_competition (competition_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  group_id BIGINT,
  session_name VARCHAR(255) NOT NULL,
  stage_name VARCHAR(100),
  start_at DATETIME,
  end_at DATETIME,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  current_performance_id BIGINT,
  INDEX idx_session_competition (competition_id, start_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_registrations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  user_id BIGINT,
  participant_name VARCHAR(100) NOT NULL,
  mobile VARCHAR(32),
  region_code VARCHAR(32),
  instructor_name VARCHAR(100),
  choreographer_name VARCHAR(100),
  registration_status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  payment_status VARCHAR(32) NOT NULL DEFAULT 'unpaid',
  order_id BIGINT,
  registered_at DATETIME,
  paid_at DATETIME,
  legacy_player_id VARCHAR(128),
  INDEX idx_registration_event (competition_id, group_id),
  INDEX idx_registration_user (user_id),
  INDEX idx_registration_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_participants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  registration_id BIGINT NOT NULL,
  user_id BIGINT,
  display_no VARCHAR(32),
  name VARCHAR(100) NOT NULL,
  institution_name VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  INDEX idx_participant_registration (registration_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_performances (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  registration_id BIGINT NOT NULL,
  participant_id BIGINT,
  title VARCHAR(255),
  style_code VARCHAR(64),
  performance_order INT,
  checkin_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  performance_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  final_score DECIMAL(10,3),
  rank_no INT,
  INDEX idx_performance_group (competition_id, group_id, performance_order),
  INDEX idx_performance_registration (registration_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_music_files (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  performance_id BIGINT NOT NULL,
  file_id BIGINT,
  legacy_url VARCHAR(1000),
  duration_text VARCHAR(100),
  review_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  review_note VARCHAR(500),
  reviewed_by BIGINT,
  reviewed_at DATETIME,
  INDEX idx_music_performance (performance_id),
  INDEX idx_music_status (review_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_judges (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  name VARCHAR(100) NOT NULL,
  mobile VARCHAR(32),
  mobile_hash CHAR(64),
  institution_name VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  source_note VARCHAR(255),
  UNIQUE KEY uk_judge_mobile_hash (mobile_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_judge_assignments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  judge_id BIGINT NOT NULL,
  is_lead TINYINT(1) NOT NULL DEFAULT 0,
  scoring_enabled TINYINT(1) NOT NULL DEFAULT 1,
  locked TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_judge_group (group_id, judge_id),
  INDEX idx_assignment_competition (competition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_score_rules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  group_id BIGINT,
  rule_name VARCHAR(100) NOT NULL,
  score_item VARCHAR(100) NOT NULL,
  max_score DECIMAL(10,3) NOT NULL DEFAULT 10,
  weight DECIMAL(10,4) NOT NULL DEFAULT 1,
  drop_high_low TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  INDEX idx_score_rule_event (competition_id, group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_score_entries (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  performance_id BIGINT NOT NULL,
  participant_id BIGINT,
  judge_id BIGINT NOT NULL,
  score_rule_id BIGINT,
  raw_score DECIMAL(10,3) NOT NULL,
  calculated_score DECIMAL(10,3),
  score_status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  submitted_at DATETIME,
  source_code VARCHAR(64),
  legacy_score_id VARCHAR(128),
  UNIQUE KEY uk_score_entry (performance_id, judge_id, score_rule_id, legacy_score_id),
  INDEX idx_score_group (competition_id, group_id),
  INDEX idx_score_judge (judge_id, submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_score_results (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  performance_id BIGINT NOT NULL,
  participant_id BIGINT,
  raw_total DECIMAL(10,3),
  calculated_total DECIMAL(10,3),
  published_score DECIMAL(10,3),
  rank_no INT,
  result_status VARCHAR(32) NOT NULL DEFAULT 'calculated',
  calculated_at DATETIME,
  published_at DATETIME,
  UNIQUE KEY uk_result_performance (performance_id),
  INDEX idx_result_group_rank (competition_id, group_id, rank_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_score_audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  group_id BIGINT,
  performance_id BIGINT,
  score_entry_id BIGINT,
  action VARCHAR(64) NOT NULL,
  before_json JSON,
  after_json JSON,
  operator_id BIGINT,
  operated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_score_audit_target (performance_id, score_entry_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_awards (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  group_id BIGINT,
  award_name VARCHAR(100) NOT NULL,
  rank_from INT,
  rank_to INT,
  certificate_template_id BIGINT,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_certificates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  participant_id BIGINT,
  performance_id BIGINT,
  award_id BIGINT,
  certificate_no VARCHAR(128) NOT NULL UNIQUE,
  file_id BIGINT,
  issue_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  issued_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_result_publish_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  group_id BIGINT,
  publish_scope VARCHAR(64) NOT NULL,
  publish_status VARCHAR(32) NOT NULL,
  snapshot_json JSON,
  operator_id BIGINT,
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_bigscreen_states (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  session_id BIGINT,
  current_group_id BIGINT,
  current_performance_id BIGINT,
  screen_mode VARCHAR(64) NOT NULL DEFAULT 'ranking',
  state_json JSON,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_bigscreen_competition (competition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 运营增长层

CREATE TABLE growth_member_points (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  business_type VARCHAR(64) NOT NULL,
  business_id BIGINT,
  points_change INT NOT NULL,
  points_balance INT,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  legacy_integral_id VARCHAR(128),
  INDEX idx_points_user (user_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE growth_member_profiles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL UNIQUE,
  total_events INT NOT NULL DEFAULT 0,
  total_awards INT NOT NULL DEFAULT 0,
  total_orders DECIMAL(12,2) NOT NULL DEFAULT 0,
  preferred_city VARCHAR(64),
  preferred_group VARCHAR(128),
  last_event_at DATETIME,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE growth_course_recommendations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  source_event_id BIGINT,
  recommendation_type VARCHAR(64) NOT NULL,
  course_title VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE growth_conversion_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  source_type VARCHAR(64) NOT NULL,
  source_id BIGINT,
  target_type VARCHAR(64) NOT NULL,
  target_id BIGINT,
  conversion_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  amount DECIMAL(10,2) DEFAULT 0,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE growth_event_reviews (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  metric_json JSON,
  review_text LONGTEXT,
  created_by BIGINT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 迁移来源初始登记

INSERT INTO migration_sources (source_code, source_name, source_type, file_path, row_count, table_count, note) VALUES
('software_cloud', '旧主业务库', 'mysql_dump', '旧程序数据/software_cloud.sql', 94813, 31, '赛事、组别、报名/选手、用户、评委、评分、后台权限、日志、地区字典'),
('software_config', '旧配置库', 'mysql_dump', '旧程序数据/software_config.sql', 22, 12, 'Nacos 配置、服务路由、文件服务、旧环境连接信息；只做安全审计和架构复盘'),
('api_vmp', '早期投票报名库', 'mysql_dump_gzip', '旧程序数据/api_vmp_20231031_190745.sql.gz', 12, 10, '早期小程序赛事、报名、节目、投票评分模型'),
('competition_users_xlsx', '产赛用户 Excel', 'excel', '旧程序数据/产赛用户.xlsx', 2033, 1, '用户ID、昵称、手机号补充清单'),
('judges_xlsx', '评委 Excel', 'excel', '旧程序数据/评委数据.xlsx', 256, 1, '评委昵称、手机号补充清单'),
('mp_vote_source', '旧微信小程序源码', 'source_code', '旧程序数据/小程序mp-vote', 26, 0, '报名、支付、评分、排行、个人中心接口语义来源');

-- 核心字段映射初始登记。完整字段在迁移脚本中继续补齐。

INSERT INTO migration_field_mappings
(source_code, legacy_table, legacy_field, target_table, target_field, transform_rule, required_flag, note) VALUES
('software_cloud', 'dfwq_competition', 'id', 'event_competitions', 'id', '生成新ID，旧ID写入 legacy_id_map', 1, '赛事主档'),
('software_cloud', 'dfwq_competition', 'comps_name', 'event_competitions', 'name', '原样保留，另可生成 display_name', 1, '赛事名称'),
('software_cloud', 'dfwq_competition', 'startDate', 'event_competitions', 'start_at', 'datetime 标准化', 0, '赛事开始'),
('software_cloud', 'dfwq_competition', 'endDate', 'event_competitions', 'end_at', 'datetime 标准化', 0, '赛事结束'),
('software_cloud', 'dfwq_competition', 'citys', 'event_competitions', 'city_code', '编码/文本识别后关联 platform_regions', 0, '地区治理'),
('software_cloud', 'dfwq_competition', 'comps_posterPic', 'platform_files', 'storage_url', '生成 poster_file_id 回写赛事', 0, '赛事海报'),
('software_cloud', 'dfwq_group', 'id', 'event_groups', 'id', '生成新ID，旧ID写入 legacy_id_map', 1, '组别主档'),
('software_cloud', 'dfwq_group', 'comps_id', 'event_groups', 'competition_id', '通过 legacy_id_map 查找新赛事ID', 1, '赛事外键'),
('software_cloud', 'dfwq_group', 'group_name', 'event_groups', 'name', '原样保留，后续拆年龄/赛制标签', 1, '组别名称'),
('software_cloud', 'dfwq_group', 'comps_time', 'event_sessions', 'start_at', '生成场次记录', 0, '现场赛程'),
('software_cloud', 'dfwq_player', 'id', 'event_registrations', 'legacy_player_id', '保留旧报名/选手ID', 1, '旧 ID 追溯'),
('software_cloud', 'dfwq_player', 'uid', 'platform_users', 'id', '按旧用户ID/手机号/openid 综合匹配', 0, '用户归并'),
('software_cloud', 'dfwq_player', 'name', 'event_participants', 'name', '选手姓名', 1, '选手主档'),
('software_cloud', 'dfwq_player', 'show_name', 'event_performances', 'title', '作品/节目名称', 0, '节目主档'),
('software_cloud', 'dfwq_player', 'mp3_file', 'event_music_files', 'legacy_url', '文件 URL 原样保留，并尝试入 platform_files', 0, '音乐文件'),
('software_cloud', 'dfwq_player', 'signOrder', 'platform_orders', 'order_no', '报名订单号', 0, '支付归并'),
('software_cloud', 'dfwq_player', 'cost', 'platform_orders', 'amount', '报名费用', 0, '订单金额'),
('software_cloud', 'dfwq_player', 'score', 'event_score_results', 'published_score', '作为旧发布总分，不覆盖原始分', 0, '成绩结果'),
('software_cloud', 'dfwq_score', 'id', 'event_score_entries', 'legacy_score_id', '保留旧评分ID', 1, '评分追溯'),
('software_cloud', 'dfwq_score', 'scoreValue', 'event_score_entries', 'raw_score', '原始分永久保留', 1, '评分生命线'),
('software_cloud', 'dfwq_score', 'judges_id', 'event_score_entries', 'judge_id', '通过评委映射查找新ID', 1, '评委外键'),
('software_cloud', 'dfwq_groupjudges', 'judges_id', 'event_judge_assignments', 'judge_id', '评委授权关系', 1, '评委分配'),
('software_cloud', 'dfwq_groupjudges', 'isLeader', 'event_judge_assignments', 'is_lead', '0/1 标准化', 0, '评委组长'),
('software_cloud', 'dfwq_comps_user', 'tel', 'platform_users', 'mobile', '手机号清洗，mobile_hash 用于去重', 0, '用户联系方式'),
('software_cloud', 'dfwq_comps_user', 'isJudges', 'event_judges', 'user_id', 'isJudges=1 时生成评委主档', 0, '评委身份'),
('software_cloud', 'dfwq_integral', 'integral_value', 'growth_member_points', 'points_change', '积分行为标准化', 0, '增长积分'),
('api_vmp', 'vmpdb_comps', 'cid', 'event_competitions', 'id', '生成新ID，旧 cid 写入 legacy_id_map', 1, '早期赛事'),
('api_vmp', 'vmpdb_signups', 'sid', 'event_registrations', 'id', '生成新报名ID，旧 sid 写入 legacy_id_map', 1, '早期报名'),
('api_vmp', 'vmpdb_votes', 'detail1', 'event_score_entries', 'raw_score', '按评分项拆成多条记录', 0, '早期分项评分'),
('competition_users_xlsx', 'Sheet1', '手机号码', 'platform_users', 'mobile', '按手机号补齐用户', 0, 'Excel 用户补充'),
('judges_xlsx', 'Sheet1', '手机号码', 'event_judges', 'mobile', '按手机号与 SQL 评委合并', 1, 'Excel 评委补充');
