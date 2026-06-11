function popularitySeed(item) {
  return String(item && (item.id || item.source_id || item.name) || "eva-course");
}

const MIN_POPULARITY_BASE = 500;
const MAX_POPULARITY_BASE = 2000;
const POPULARITY_BASE_RANGE = MAX_POPULARITY_BASE - MIN_POPULARITY_BASE + 1;
const popularityBaseBySeed = {};
const usedPopularityBases = {};

function stableRandomBase(seed) {
  if (popularityBaseBySeed[seed] !== undefined) return popularityBaseBySeed[seed];

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  let base = MIN_POPULARITY_BASE + (hash % POPULARITY_BASE_RANGE);
  for (let offset = 0; offset < POPULARITY_BASE_RANGE; offset += 1) {
    if (!usedPopularityBases[base] || usedPopularityBases[base] === seed) {
      usedPopularityBases[base] = seed;
      popularityBaseBySeed[seed] = base;
      return base;
    }
    base = base >= MAX_POPULARITY_BASE ? MIN_POPULARITY_BASE : base + 1;
  }

  popularityBaseBySeed[seed] = base;
  return base;
}

function realAuthorizedCount(item) {
  return Number(item && (item.total_students || item.students || item.user_count || item.views) || 0);
}

function popularityValue(item) {
  return stableRandomBase(popularitySeed(item)) + realAuthorizedCount(item);
}

function popularityText(item) {
  return `${popularityValue(item)}人气`;
}

module.exports = {
  popularityText,
  popularityValue
};
