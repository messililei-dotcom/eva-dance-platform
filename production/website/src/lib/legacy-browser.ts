export function getIOSVersion(userAgent: string): { major: number; minor: number } | null {
  if (!/(iPhone|iPad|iPod)/i.test(userAgent)) return null;
  const match = userAgent.match(/(?:CPU (?:iPhone )?OS|iPhone OS) (\d+)[._](\d+)/i);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

export function shouldUseLegacyProfile(userAgent: string): boolean {
  const version = getIOSVersion(userAgent);
  if (!version) return false;
  return version.major < 16 || (version.major === 16 && version.minor < 4);
}
