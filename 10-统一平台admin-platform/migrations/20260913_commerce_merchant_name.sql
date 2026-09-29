-- Preserve historical order snapshots. Normalize the v1 default on NEW orders only.
CREATE TRIGGER IF NOT EXISTS commerce_merchant_legal_name
AFTER INSERT ON CommerceOrder
WHEN NEW.merchant_name = '伊娃文化公司'
BEGIN
  UPDATE CommerceOrder SET merchant_name = '伊娃文化艺术发展（湖南）有限公司'
  WHERE id = NEW.id;
END;
