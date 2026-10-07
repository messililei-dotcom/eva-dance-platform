import { AppError } from './app-session';
export type AppPlatform = 'ios' | 'android' | 'harmony';
// Analytics / device labeling only. This header never grants permissions or proves app identity.
export function appPlatform(headers: Headers): AppPlatform {
  const value = headers.get('x-client-platform');
  if (value === null) return 'ios'; // Existing shipped development clients.
  if (value === 'ios' || value === 'android' || value === 'harmony') return value;
  throw new AppError('不支持的客户端平台', 400);
}
export const appMemberSource = (platform: AppPlatform) => `${platform}_app`;
export const appDeviceName = (platform: AppPlatform) => ({ios:'iPhone / iPad',android:'Android',harmony:'HarmonyOS'})[platform];
