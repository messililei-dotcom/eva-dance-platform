import { createHmac } from 'node:crypto';

const appId = 'wxc2878927a69379ef';
const [action = 'plan', seriesArg = '21'] = process.argv.slice(2);
const seriesId = Number(seriesArg);
const adminOrigin = 'https://admin.swod.com.cn';
const env = 1;

function safeDetail(value) {
  return typeof value === 'string'
    ? value.replace(/https?:\/\/[^\s]+/g, '[URL]').replace(/[A-Za-z0-9_-]{24,}/g, '[已隐藏]').slice(0, 180)
    : '';
}

async function json(url, body) {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(12000),
    ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body }),
  });
  const data = await response.json();
  if (!response.ok || data.errcode || data.success === false) {
    const detail = safeDetail(data.errmsg);
    throw new Error('接口失败，HTTP ' + response.status + '，微信错误码 ' + (Number(data.errcode) || '无') + (detail ? '，' + detail : ''));
  }
  return data;
}

async function main() {
  if (!['plan', 'query', 'upload', 'publish'].includes(action) || !Number.isSafeInteger(seriesId) || seriesId <= 0) {
    throw new Error('用法：node scripts/mini-virtual-sandbox-goods.mjs <plan|query|upload|publish> [课程ID]');
  }
  const { offer } = await json(adminOrigin + '/api/mini/shop/courses/online/' + seriesId);
  if (offer?.kind !== 'online' || offer.id !== seriesId || !Number.isSafeInteger(offer.priceFen) || offer.priceFen <= 0) {
    throw new Error('线上课报价无效');
  }
  const image = new URL(seriesId === 21 ? '/uploads/ecommerce/products/swod-xpay-goods-21-sandbox-200.png' : offer.image, adminOrigin);
  if (image.protocol !== 'https:' || image.origin !== adminOrigin || !/\.(jpe?g|png)$/i.test(image.pathname)) {
    throw new Error('沙箱道具需要后台的 JPG 或 PNG 封面');
  }
  const item = {
    id: 'swod_test_' + seriesId,
    name: Array.from(('沙箱·' + offer.name).replace(/[^\p{Script=Han}A-Za-z0-9_*·-]/gu, '')).slice(0, 20).join(''),
    price: offer.priceFen,
    remark: '录播课虚拟支付沙箱联调，课程 ID ' + seriesId,
    item_url: image.href,
  };
  if (item.id.length > 20) throw new Error('道具 ID 超过 20 字符');
  const plan = { appId, env, seriesId, item };
  if (action === 'plan') {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const configuredAppId = process.env.WECHAT_MINIAPP_APP_ID || process.env.WECHAT_MINIAPP_APPID;
  const secret = process.env.WECHAT_MINIAPP_SECRET || process.env.WX_MINIAPP_SECRET;
  const appKey = process.env.WECHAT_VIRTUAL_SANDBOX_APP_KEY;
  if (configuredAppId !== appId || !secret || !appKey) throw new Error('缺少正确的小程序服务端凭证或沙箱 AppKey');
  const { access_token: accessToken } = await json('https://api.weixin.qq.com/cgi-bin/stable_token', JSON.stringify({
    grant_type: 'client_credential', appid: appId, secret, force_refresh: false,
  }));
  if (!accessToken) throw new Error('微信访问凭证不可用');

  async function xpay(endpoint, payload) {
    const path = '/xpay/' + endpoint;
    const body = JSON.stringify({ ...payload, env });
    const url = new URL(path, 'https://api.weixin.qq.com');
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('pay_sig', createHmac('sha256', appKey).update(path + '&' + body).digest('hex'));
    return json(url, body);
  }

  const readUpload = () => xpay('query_upload_goods', {});
  const readPublish = () => xpay('query_publish_goods', {});
  const find = (items) => Array.isArray(items) ? items.find(value => value.id === item.id) : undefined;

  if (action === 'query') {
    const upload = await readUpload();
    const publish = await readPublish();
    const uploaded = find(upload.upload_item);
    const published = find(publish.publish_item);
    console.log(JSON.stringify({
      appId, env, id: item.id, expectedPriceFen: item.price, uploadTask: upload.status ?? null,
      uploadStatus: uploaded?.upload_status ?? null, uploadedPriceFen: uploaded?.price ?? null, uploadError: safeDetail(uploaded?.errmsg),
      publishTask: publish.status ?? null, publishStatus: published?.publish_status ?? null, publishError: safeDetail(published?.errmsg),
    }));
  }
  if (action === 'upload') {
    const upload = await readUpload();
    if (upload.status === 1) throw new Error('微信已有上传任务在运行');
    const prior = find(upload.upload_item);
    if (prior && !(upload.status === 2 && prior.upload_status === 3 && prior.errmsg?.includes('200*200'))) {
      throw new Error('最近任务已有此道具，请先查询状态');
    }
    if (seriesId === 21) {
      const cover = await fetch(item.item_url, { redirect: 'error', signal: AbortSignal.timeout(8000) });
      const bytes = Buffer.from(await cover.arrayBuffer());
      if (!cover.ok || bytes.length < 24 || bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a' ||
          bytes.readUInt32BE(16) !== 200 || bytes.readUInt32BE(20) !== 200) {
        throw new Error('沙箱道具图片必须为 200×200 PNG');
      }
    }
    await xpay('start_upload_goods', { upload_item: [item] });
    console.log(JSON.stringify({ appId, env, id: item.id, submitted: 'upload' }));
  }
  if (action === 'publish') {
    const upload = await readUpload();
    const uploaded = find(upload.upload_item);
    if (uploaded?.upload_status !== 2 || uploaded.price !== item.price) {
      throw new Error('未确认该道具上传成功且价格一致，请先查询');
    }
    const publish = await readPublish();
    if (publish.status === 1 || find(publish.publish_item)) throw new Error('请先核对已有发布任务');
    await xpay('start_publish_goods', { publish_item: [{ id: item.id }] });
    console.log(JSON.stringify({ appId, env, id: item.id, submitted: 'publish' }));
  }
}

main().catch(error => {
  console.error(error instanceof TypeError ? '网络连接失败' : error.message);
  process.exitCode = 1;
});
