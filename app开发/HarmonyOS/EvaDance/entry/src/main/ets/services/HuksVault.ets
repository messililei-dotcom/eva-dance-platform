import { huks } from '@kit.UniversalKeystoreKit';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { fileIo } from '@kit.CoreFileKit';
import { util } from '@kit.ArkTS';

interface SealedValue { nonce: string; cipher: string; }
/** AEAD ciphertext in the application sandbox; the key is generated and retained by HUKS. */
export class HuksVault {
  private alias: string;
  private path: string;
  private queue: Promise<void> = Promise.resolve();
  constructor(directory: string, name: string) { this.alias = 'cn.com.swod.evadance.' + name; this.path = directory + '/' + name + '.sealed'; }
  private props(purpose: number): huks.HuksParam[] {
    return [{ tag: huks.HuksTag.HUKS_TAG_ALGORITHM, value: huks.HuksKeyAlg.HUKS_ALG_AES },
      { tag: huks.HuksTag.HUKS_TAG_KEY_SIZE, value: 256 }, { tag: huks.HuksTag.HUKS_TAG_PURPOSE, value: purpose },
      { tag: huks.HuksTag.HUKS_TAG_BLOCK_MODE, value: huks.HuksCipherMode.HUKS_MODE_GCM },
      { tag: huks.HuksTag.HUKS_TAG_PADDING, value: huks.HuksKeyPadding.HUKS_PADDING_NONE }];
  }
  private async key(): Promise<void> {
    if (await huks.isKeyItemExist(this.alias, { properties: [] })) return;
    if (fileIo.accessSync(this.path)) throw new Error('安全存储密钥不可用，请重新登录');
    await huks.generateKeyItem(this.alias, { properties: this.props(huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_ENCRYPT | huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_DECRYPT) });
  }
  private async crypt(input: Uint8Array, nonce: Uint8Array, encrypt: boolean): Promise<Uint8Array> {
    const params = this.props(encrypt ? huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_ENCRYPT : huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_DECRYPT);
    params.push({ tag: huks.HuksTag.HUKS_TAG_NONCE, value: nonce });
    params.push({ tag: huks.HuksTag.HUKS_TAG_ASSOCIATED_DATA, value: new util.TextEncoder().encodeInto(this.alias) });
    let data = input;
    if (!encrypt) {
      if (input.length < 16) throw new Error('安全存储无效');
      params.push({ tag: huks.HuksTag.HUKS_TAG_AE_TAG, value: input.slice(input.length - 16) });
      data = input.slice(0, input.length - 16);
    }
    const handle = await huks.initSession(this.alias, { properties: params });
    try {
      const result = await huks.finishSession(handle.handle, { properties: params, inData: data });
      if (!result.outData) throw new Error('安全存储操作失败');
      return result.outData;
    } catch (error) { try { await huks.abortSession(handle.handle, { properties: [] }); } catch {} throw new Error('安全存储操作失败'); }
  }
  async read(): Promise<string | undefined> {
    await this.queue;
    if (!fileIo.accessSync(this.path)) return undefined;
    await this.key();
    const value = JSON.parse(fileIo.readTextSync(this.path)) as SealedValue;
    const helper = new util.Base64Helper();
    const plain = await this.crypt(helper.decodeSync(value.cipher), helper.decodeSync(value.nonce), false);
    return util.TextDecoder.create('utf-8').decodeToString(plain);
  }
  save(value: string): Promise<void> {
    const operation = this.queue.catch(() => {}).then(async () => {
      await this.key(); const nonce = (await cryptoFramework.createRandom().generateRandom(12)).data;
      const result = await this.crypt(new util.TextEncoder().encodeInto(value), nonce, true);
      const helper = new util.Base64Helper();
      const envelope: SealedValue = { nonce: helper.encodeToStringSync(nonce), cipher: helper.encodeToStringSync(result) };
      const temp = this.path + '.tmp'; const file = fileIo.openSync(temp, fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC | fileIo.OpenMode.WRITE_ONLY);
      try { fileIo.writeSync(file.fd, JSON.stringify(envelope)); fileIo.fsyncSync(file.fd); } finally { fileIo.closeSync(file); }
      fileIo.renameSync(temp, this.path);
    });
    this.queue = operation; return operation;
  }
}
