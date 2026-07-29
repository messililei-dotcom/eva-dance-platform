export const DEFAULT_COURSE_ADVISORS = ['海艳', '七七', '伊琳', '伊娃老师'];

export function buildCourseAdvisorOptions(values: Array<unknown> = []) {
  const seen = new Set<string>();

  return [...DEFAULT_COURSE_ADVISORS, ...values]
    .map(value => String(value ?? '').trim())
    .filter(value => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .map(value => ({ value, label: value }));
}

export function filterCourseAdvisorOption(input: string, option?: { value?: unknown; label?: unknown }) {
  const query = input.trim().toLowerCase();
  if (!query) return true;
  return [option?.value, option?.label]
    .some(value => String(value ?? '').toLowerCase().includes(query));
}
