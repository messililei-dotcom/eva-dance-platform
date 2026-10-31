import { common, bundleManager } from '@kit.AbilityKit';
import { util } from '@kit.ArkTS';
import PhoneNumberAuthHelper, { AuthUiConfig, TokenResultListener } from 'numberauth_standard';

interface CarrierConfig { bundleName: string; appIdentifier: string; certificateSHA256: string; sdkSecret: string; }
interface CarrierToken { _code?: string; _token?: string; }

class CarrierListener implements TokenResultListener {
  private owner: CarrierLogin;
  constructor(owner: CarrierLogin) { this.owner = owner; }
  onSuccess(message: string): void { this.owner.receive(message, true); }
  onFailure(message: string): void { this.owner.receive(message, false); }
}

/** Only an operator-issued token is sent to the server. No client phone is trusted. */
export class CarrierLogin {
  private helper?: PhoneNumberAuthHelper;
  private resolve?: (token: string) => void;
  private reject?: (error: Error) => void;
  private timer: number = -1;
  async token(context: common.UIAbilityContext): Promise<string> {
    if (this.resolve) throw new Error('正在获取本机号码，请稍候');
    let config: CarrierConfig;
    try {
      const bytes = await context.resourceManager.getRawFileContent('number-auth.local.json');
      config = JSON.parse(util.TextDecoder.create('utf-8').decodeToString(bytes)) as CarrierConfig;
      const info = await bundleManager.getBundleInfoForSelf(bundleManager.BundleFlag.GET_BUNDLE_INFO_WITH_SIGNATURE_INFO);
      const fingerprint = info.signatureInfo.fingerprint.replace(/:/g, '').toLowerCase();
      if (!config.sdkSecret || config.bundleName !== info.name || config.appIdentifier !== info.signatureInfo.appIdentifier ||
        config.certificateSHA256.replace(/:/g, '').toLowerCase() !== fingerprint) throw new Error('configuration');
    } catch { throw new Error('本机号码登录配置未就绪，请使用短信登录'); }
    return new Promise<string>((resolve, reject) => {
      this.resolve = resolve; this.reject = reject;
      this.timer = setTimeout(() => this.finish('', '本机号码登录超时，请使用短信登录'), 20000);
      this.launch(context, config).catch(() => this.finish('', '本机号码登录暂不可用，请使用短信登录'));
    });
  }
  private async launch(context: common.UIAbilityContext, config: CarrierConfig): Promise<void> {
    this.helper = PhoneNumberAuthHelper.getInstance(context, new CarrierListener(this));
    await this.helper.setAuthSDKInfo(config.sdkSecret);
    if (!this.resolve || !this.helper) return;
    const ui = new AuthUiConfig();
    ui.privacyCbIsOn = false;
    ui.privacySpanOneText = '隐私政策'; ui.privacySpanOneUrl = 'https://www.swod.com.cn/privacy';
    ui.privacySpanTwoText = '服务条款'; ui.privacySpanTwoUrl = 'https://www.swod.com.cn/terms';
    this.helper.setAuthConfig(ui);
    await this.helper.getLoginToken(8000);
  }
  receive(message: string, success: boolean): void {
    if (!this.resolve) return;
    try {
      const result = JSON.parse(message) as CarrierToken;
      if (success && result._code === '600000' && result._token) this.finish(result._token, '');
      else if (result._code === '700000' || result._code === '700001') this.finish('', '已取消本机号码登录');
      else if (!success) this.finish('', '本机号码登录暂不可用，请使用短信登录');
    } catch { this.finish('', '号码认证响应异常，请使用短信登录'); }
  }
  cancel(): void { this.finish('', '已取消本机号码登录'); }
  private finish(token: string, message: string): void {
    if (this.timer >= 0) clearTimeout(this.timer);
    this.timer = -1;
    const resolve = this.resolve; const reject = this.reject;
    this.resolve = undefined; this.reject = undefined;
    if (this.helper) { this.helper.clearAuthListener(); this.helper.quitLoginPage().catch(() => {}); this.helper = undefined; }
    if (token) resolve?.(token); else reject?.(new Error(message));
  }
}
