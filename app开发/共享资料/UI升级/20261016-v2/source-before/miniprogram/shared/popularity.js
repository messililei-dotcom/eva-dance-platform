const PUBLIC_STUDENT_BASE_MIN = 500;
const PUBLIC_STUDENT_BASE_MAX = 1000;
const PUBLIC_STUDENT_BASE_RANGE = PUBLIC_STUDENT_BASE_MAX - PUBLIC_STUDENT_BASE_MIN + 1;
const STORAGE_KEY = "courseStudentDisplayBasesV1";

const baseBySeed = {};
const seedByBase = {};
let storageLoaded = false;

function courseSeed(item) {
  const source = item || {};
  const id = source.id || source.series_id || source.source_id || "";
  const name = source.name || source.series_name || "";
  return `${id}|${name}` || "eva-course";
}

function loadStoredBases() {
  if (storageLoaded) return;
  storageLoaded = true;
  if (typeof wx === "undefined" || typeof wx.getStorageSync !== "function") return;
  const stored = wx.getStorageSync(STORAGE_KEY) || {};
  Object.keys(stored).forEach(seed => {
    const base = Number(stored[seed]);
    if (!Number.isInteger(base) || base < PUBLIC_STUDENT_BASE_MIN || base > PUBLIC_STUDENT_BASE_MAX) return;
    if (seedByBase[base] && seedByBase[base] !== seed) return;
    baseBySeed[seed] = base;
    seedByBase[base] = seed;
  });
}

function saveStoredBases() {
  if (typeof wx === "undefined" || typeof wx.setStorageSync !== "function") return;
  try {
    wx.setStorageSync(STORAGE_KEY, baseBySeed);
  } catch (err) {
    // 存储空间不可用时仍保留当前小程序会话内的稳定基数。
  }
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function stableStudentBase(item) {
  const configured = Number(item && item.student_display_base);
  if (Number.isInteger(configured) && configured >= PUBLIC_STUDENT_BASE_MIN && configured <= PUBLIC_STUDENT_BASE_MAX) return configured;
  loadStoredBases();
  const seed = courseSeed(item);
  if (baseBySeed[seed] !== undefined) return baseBySeed[seed];

  let base = PUBLIC_STUDENT_BASE_MIN + (hashSeed(seed) % PUBLIC_STUDENT_BASE_RANGE);
  for (let offset = 0; offset < PUBLIC_STUDENT_BASE_RANGE; offset += 1) {
    if (!seedByBase[base] || seedByBase[base] === seed) {
      baseBySeed[seed] = base;
      seedByBase[base] = seed;
      saveStoredBases();
      return base;
    }
    base = base >= PUBLIC_STUDENT_BASE_MAX ? PUBLIC_STUDENT_BASE_MIN : base + 1;
  }

  return base;
}

function popularityValue(item) {
  const realStudentCount = Number(item && item.total_students || 0);
  return (Number.isFinite(realStudentCount) ? realStudentCount : 0) + stableStudentBase(item);
}

function popularityText(item) {
  return `${popularityValue(item)}名学员`;
}

module.exports = {
  PUBLIC_STUDENT_BASE_MIN,
  PUBLIC_STUDENT_BASE_MAX,
  popularityText,
  popularityValue,
  stableStudentBase
};
