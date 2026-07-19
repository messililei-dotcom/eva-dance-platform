-- 同一学员、同一课程系列只保留最新的有效授权。
-- 历史记录不删除，较旧记录改为 revoked，便于审计和恢复。

BEGIN IMMEDIATE;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY member_id, series_id
      ORDER BY granted_at DESC, id DESC
    ) AS row_number
  FROM CourseAuthorization
  WHERE status = 'active'
    AND member_id IS NOT NULL
    AND member_id > 0
)
UPDATE CourseAuthorization
SET
  status = 'revoked',
  revoked_at = datetime('now', 'localtime'),
  revoked_by = COALESCE(revoked_by, 1),
  remark = CASE
    WHEN trim(COALESCE(remark, '')) = ''
      THEN '系统清理重复有效授权，保留同学员同课程最新记录'
    ELSE remark || '；系统清理重复有效授权，保留最新记录'
  END
WHERE id IN (SELECT id FROM ranked WHERE row_number > 1);

DROP TRIGGER IF EXISTS trg_course_auth_single_active_after_insert;
CREATE TRIGGER trg_course_auth_single_active_after_insert
AFTER INSERT ON CourseAuthorization
WHEN NEW.status = 'active'
  AND NEW.member_id IS NOT NULL
  AND NEW.member_id > 0
BEGIN
  UPDATE CourseAuthorization
  SET
    status = 'revoked',
    revoked_at = datetime('now', 'localtime'),
    revoked_by = COALESCE(NEW.granted_by, 1),
    remark = CASE
      WHEN trim(COALESCE(remark, '')) = ''
        THEN '系统自动撤销重复有效授权，保留最新记录'
      ELSE remark || '；系统自动撤销重复有效授权，保留最新记录'
    END
  WHERE member_id = NEW.member_id
    AND series_id = NEW.series_id
    AND status = 'active'
    AND id <> NEW.id;
END;

DROP TRIGGER IF EXISTS trg_course_auth_single_active_after_update;
CREATE TRIGGER trg_course_auth_single_active_after_update
AFTER UPDATE OF status, member_id, series_id ON CourseAuthorization
WHEN NEW.status = 'active'
  AND NEW.member_id IS NOT NULL
  AND NEW.member_id > 0
BEGIN
  UPDATE CourseAuthorization
  SET
    status = 'revoked',
    revoked_at = datetime('now', 'localtime'),
    revoked_by = COALESCE(NEW.granted_by, 1),
    remark = CASE
      WHEN trim(COALESCE(remark, '')) = ''
        THEN '系统自动撤销重复有效授权，保留最新记录'
      ELSE remark || '；系统自动撤销重复有效授权，保留最新记录'
    END
  WHERE member_id = NEW.member_id
    AND series_id = NEW.series_id
    AND status = 'active'
    AND id <> NEW.id;
END;

COMMIT;
