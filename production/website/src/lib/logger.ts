export function devWarn(message: string, detail?: unknown) {
  if (process.env.NODE_ENV === 'production') return;
  if (detail === undefined) {
    console.warn(message);
    return;
  }
  console.warn(message, detail);
}
