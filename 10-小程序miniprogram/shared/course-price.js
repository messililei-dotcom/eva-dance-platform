const { formatPrice } = require('./money-format');

// Match the server quote: a positive promotional price takes precedence.
function coursePrice(course = {}, unlocked = false) {
  if (unlocked === null) return { accessPending: true, canPurchase: false, hasDiscount: false, priceText: '', priceLabel: '', originalPriceText: '' };
  if (unlocked) return { unlocked: true, accessText: '✓ 已解锁', actionText: '继续学习', canPurchase: false, hasDiscount: false, priceText: '', priceLabel: '', originalPriceText: '' };
  const original = Number(course.price);
  const promo = Number(course.promo_price);
  const isFree = course.is_free === true || Number(course.is_free) === 1;
  const amount = isFree ? 0 : Number.isFinite(promo) && promo > 0 ? promo : original;
  const canPurchase = !isFree && Number.isFinite(amount) && amount > 0;
  const hasDiscount = canPurchase && Number.isFinite(original) && original > amount;
  return {
    canPurchase,
    hasDiscount,
    priceText: isFree ? '免费' : canPurchase ? formatPrice(amount) : '咨询价格',
    priceLabel: hasDiscount ? '优惠价' : '售价',
    originalPriceText: hasDiscount ? formatPrice(original) : ''
  };
}

module.exports = { coursePrice };
