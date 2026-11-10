export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function needsManualInstall(userAgent: string) {
  return /huawei|harmonyos|hongmeng|huaweibrowser/i.test(userAgent);
}

// Some browsers expose the event but never open or settle the native dialog.
export async function requestPwaInstall(event: InstallPromptEvent | null, timeoutMs = 8000) {
  if (!event) return 'manual' as const;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      (async () => {
        await event.prompt();
        return (await event.userChoice).outcome;
      })(),
      new Promise<'manual'>(resolve => { timer = setTimeout(() => resolve('manual'), timeoutMs); }),
    ]);
    return result;
  } catch {
    return 'manual' as const;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
