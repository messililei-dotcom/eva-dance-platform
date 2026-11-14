/*
 * Copyright (c) 2026 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { AbilityConstant, ConfigurationConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { platform } from '../services/PlatformApi';
import { appPush } from '../services/AppPush';

const DOMAIN = 0x0000;

export default class EntryAbility extends UIAbility {
  private activeStage?: window.WindowStage;

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    appPush.configure(this.context, want);
    try {
      this.context.getApplicationContext().setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET);
    } catch (err) {
      hilog.error(DOMAIN, 'testTag', 'Failed to set colorMode. Cause: %{public}s', JSON.stringify(err));
    }
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onCreate');
  }

  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void { appPush.handle(want); }

  onDestroy(): void {
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onDestroy');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    this.activeStage = windowStage;
    platform.protectScreen = undefined;
    platform.screenProtected = false;
    this.loadStage(windowStage);
  }

  private async loadStage(windowStage: window.WindowStage): Promise<void> {
    try {
      await platform.initialize(this.context);
      if (this.activeStage !== windowStage) return;

      const main = await windowStage.getMainWindow();
      if (this.activeStage !== windowStage) return;
      platform.protectScreen = async () => {
        if (this.activeStage !== windowStage) throw new Error('Window stage is no longer active');
        await main.setWindowPrivacyMode(true);
        if (this.activeStage !== windowStage) throw new Error('Window stage is no longer active');
        platform.screenProtected = true;
      };
      if (platform.credentials) {
        await platform.protectScreen();
      }
    } catch {
      hilog.warn(DOMAIN, 'testTag', 'Could not initialize window privacy mode.');
    }
    if (this.activeStage !== windowStage) return;

    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, 'testTag', 'Failed to load the content. Cause: %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(DOMAIN, 'testTag', '%{public}s', 'Succeeded in loading the content.');
    });
  }

  onWindowStageDestroy(): void {
    this.activeStage = undefined;
    platform.protectScreen = undefined;
    platform.screenProtected = false;
    // Main window is destroyed, release UI related resources
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onWindowStageDestroy');
  }

  onForeground(): void {
    platform.applicationActive = true;
    // Ability has brought to foreground
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onForeground');
  }

  onBackground(): void {
    platform.applicationActive = false;
    // Ability has back to background
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onBackground');
  }
}
