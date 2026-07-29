export type PageInput = {
  page: number;
  pageSize: number;
  offset: number;
};

export function readPage(url: URL, defaults: { pageSize?: number; maxPageSize?: number } = {}): PageInput {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
  const defaultPageSize = defaults.pageSize || 20;
  const maxPageSize = defaults.maxPageSize || 100;
  const pageSize = Math.min(maxPageSize, Math.max(1, Math.floor(Number(url.searchParams.get('pageSize')) || defaultPageSize)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function pagePayload<T>(data: T[], total: number, input: PageInput) {
  return { data, total, page: input.page, pageSize: input.pageSize };
}
