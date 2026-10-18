/** Authoritative online authorization financial data. Never substitute course prices.
 * Authorization revocation is an access action, not evidence of a refund.
 * A paid linked order is counted by the order ledger, not a second time here.
 */
export const DELETED_AUTHORIZATION_FINANCIAL_MARKER = '[AUTH_RECORD_FINANCIAL_DELETED]';

export const AUTHORIZATION_FINANCIAL_SQL = `
 SELECT ca.*, cs.name AS course, COALESCE(m.name, ca.phone) AS memberName,
   COALESCE(m.phone, ca.phone) AS memberPhone,
   CASE WHEN EXISTS (SELECT 1 FROM CourseOrder co WHERE co.id=ca.order_id
     AND co.status IN ('paid','completed')) THEN 0 ELSE 1 END AS standalone
 FROM CourseAuthorization ca JOIN CourseSeries cs ON cs.id=ca.series_id
 LEFT JOIN Member m ON m.id=ca.member_id
 WHERE instr(COALESCE(ca.remark,''), '${DELETED_AUTHORIZATION_FINANCIAL_MARKER}')=0
`;

export const AUTHORIZATION_INCOME_SQL = `
 SELECT id, 'AUTH-' || id AS incomeNo, '线上课程' AS category,
   '线上课程授权收入：' || course AS title, actual_amount AS amount,
   substr(granted_at,1,10) AS income_date, '' AS payment_method,
   memberName, member_id AS memberId, remark, granted_at AS created_at
 FROM (${AUTHORIZATION_FINANCIAL_SQL})
 WHERE standalone=1 AND actual_amount > 0
`;

// Old generated copies are not another receipt, even if their amount is stale.
export const MANUAL_INCOME_PREDICATE = `
 COALESCE(incomeNo,'') NOT LIKE 'AUTH-%'
 AND COALESCE(remark,'') NOT LIKE '%AUTO_ONLINE_AUTH_INCOME%authorization_id=%'
`;
