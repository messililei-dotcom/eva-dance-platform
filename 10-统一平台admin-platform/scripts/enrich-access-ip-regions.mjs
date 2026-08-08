import { createRequire } from 'node:module';
import net from 'node:net';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const dbPath = process.env.ADMIN_DB_PATH || new URL('../admin.db', import.meta.url).pathname;
const db = new Database(dbPath);

const provinceNames = {
  Anhui: '安徽省', Beijing: '北京市', Chongqing: '重庆市', Fujian: '福建省',
  Gansu: '甘肃省', Guangdong: '广东省', Guangxi: '广西壮族自治区', Guizhou: '贵州省',
  Hainan: '海南省', Hebei: '河北省', Heilongjiang: '黑龙江省', Henan: '河南省',
  Hubei: '湖北省', Hunan: '湖南省', Jiangsu: '江苏省', Jiangxi: '江西省',
  Jilin: '吉林省', Liaoning: '辽宁省', 'Inner Mongolia': '内蒙古自治区',
  Ningxia: '宁夏回族自治区', Qinghai: '青海省', Shaanxi: '陕西省', Shandong: '山东省',
  Shanghai: '上海市', Shanxi: '山西省', Sichuan: '四川省', Tianjin: '天津市',
  Tibet: '西藏自治区', Xinjiang: '新疆维吾尔自治区', Yunnan: '云南省',
  Zhejiang: '浙江省', 'Hong Kong': '香港特别行政区', Macau: '澳门特别行政区',
  Taiwan: '台湾省',
};

const cityNames = {
  Beijing: '北京市', Shanghai: '上海市', Tianjin: '天津市', Chongqing: '重庆市',
  Guangzhou: '广州市', Shenzhen: '深圳市', Changsha: '长沙市', Wuhan: '武汉市',
  Hangzhou: '杭州市', Nanjing: '南京市', Chengdu: '成都市', Xian: '西安市',
  "Xi'an": '西安市', Zhengzhou: '郑州市', Jinan: '济南市', Qingdao: '青岛市',
  Shenyang: '沈阳市', Dalian: '大连市', Harbin: '哈尔滨市', Changchun: '长春市',
  Fuzhou: '福州市', Xiamen: '厦门市', Nanchang: '南昌市', Hefei: '合肥市',
  Kunming: '昆明市', Guiyang: '贵阳市', Nanning: '南宁市', Haikou: '海口市',
  Lanzhou: '兰州市', Xining: '西宁市', Yinchuan: '银川市', Urumqi: '乌鲁木齐市',
  Hohhot: '呼和浩特市', Lhasa: '拉萨市', Shijiazhuang: '石家庄市',
  Taiyuan: '太原市', Suzhou: '苏州市', Wuxi: '无锡市', Ningbo: '宁波市',
  Dongguan: '东莞市', Foshan: '佛山市', Zhuhai: '珠海市', Wenzhou: '温州市',
  Quanzhou: '泉州市', Sanya: '三亚市', Luoyang: '洛阳市',
};

function isPublicIp(ip) {
  if (!net.isIP(ip)) return false;
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    return !lower.startsWith('fc') && !lower.startsWith('fd') && !lower.startsWith('fe80') && lower !== '::1';
  }
  const parts = ip.split('.').map(Number);
  return !(
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function locationLabel(data) {
  const region = String(data.regionName || '').trim();
  const city = String(data.cityName || '').trim();
  if (data.countryCode === 'CN') {
    const provinceLabel = provinceNames[region] || region;
    const cityLabel = cityNames[city] || city;
    if (provinceLabel && cityLabel && provinceLabel.replace(/[省市]$/, '') === cityLabel.replace(/[省市]$/, '')) {
      return provinceLabel;
    }
    return `${provinceLabel}${cityLabel}`.trim();
  }
  return [String(data.countryName || '').trim(), region, city].filter(Boolean).join(' ');
}

try {
  const ips = db.prepare(`
    SELECT DISTINCT TRIM(ip_address) AS ip
    FROM CourseSeriesVisitLog
    WHERE COALESCE(TRIM(ip_address), '') <> ''
      AND COALESCE(TRIM(ip_region), '') = ''
    ORDER BY id DESC
    LIMIT 40
  `).all().map(row => row.ip).filter(isPublicIp);

  const update = db.prepare(`
    UPDATE CourseSeriesVisitLog
    SET ip_region=?
    WHERE ip_address=? AND COALESCE(TRIM(ip_region), '')=''
  `);

  let updated = 0;
  for (const ip of ips) {
    try {
      const response = await fetch(`https://free.freeipapi.com/api/json/${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(8000),
        headers: { accept: 'application/json', 'user-agent': 'SWOD-Access-Region-Enricher/1.0' },
      });
      if (!response.ok) continue;
      const location = locationLabel(await response.json());
      if (!location) continue;
      updated += update.run(location, ip).changes;
    } catch (error) {
      console.error(`IP region lookup failed for ${ip}:`, error instanceof Error ? error.message : error);
    }
  }
  console.log(`IP region enrichment complete: ${updated} rows updated across ${ips.length} IPs.`);
} finally {
  db.close();
}
