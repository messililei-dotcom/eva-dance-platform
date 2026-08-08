'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Table as AntTable } from 'antd';
import type { AnyObject } from 'antd/es/_util/type';
import type { TableProps } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table/interface';

const DEFAULT_MIN_ROWS = 5;
const DEFAULT_MAX_ROWS = 100;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pageSizeOptions(current: number, configured?: Array<string | number>) {
  return Array.from(new Set([current, 10, 20, 30, 50, 100, ...(configured || []).map(Number)]))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)
    .map(String);
}

export type AdaptiveTableProps<RecordType extends AnyObject = AnyObject> = TableProps<RecordType> & {
  adaptiveMinRows?: number;
  adaptiveMaxRows?: number;
  adaptiveBottomGap?: number;
};

export function Table<RecordType extends AnyObject = AnyObject>({
  adaptiveMinRows = DEFAULT_MIN_ROWS,
  adaptiveMaxRows = DEFAULT_MAX_ROWS,
  adaptiveBottomGap,
  pagination,
  size,
  dataSource,
  ...props
}: AdaptiveTableProps<RecordType>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [adaptivePageSize, setAdaptivePageSize] = useState(10);

  const recalculate = useCallback(() => {
    const host = hostRef.current;
    if (!host || pagination === false || typeof window === 'undefined') return;

    const rect = host.getBoundingClientRect();
    if (!rect.width || rect.top >= window.innerHeight) return;

    const modal = host.closest('.ant-modal-content');
    const boundaryBottom = modal?.getBoundingClientRect().bottom || window.innerHeight;
    const bottomGap = adaptiveBottomGap ?? (modal ? 84 : 24);
    const measuredRowHeight = host.querySelector('.ant-table-tbody > tr')?.getBoundingClientRect().height || 0;
    const measuredHeaderHeight = host.querySelector('.ant-table-thead')?.getBoundingClientRect().height || 0;
    const measuredPagerHeight = host.querySelector('.ant-pagination')?.getBoundingClientRect().height || 0;
    const rowHeight = measuredRowHeight || (size === 'small' ? 36 : 44);
    const tableChromeHeight = (measuredHeaderHeight || 42) + (measuredPagerHeight || 40) + 14;
    const usableHeight = boundaryBottom - Math.max(0, rect.top) - bottomGap - tableChromeHeight;
    const next = clamp(Math.floor(usableHeight / rowHeight), adaptiveMinRows, adaptiveMaxRows);
    setAdaptivePageSize((current) => current === next ? current : next);
  }, [adaptiveBottomGap, adaptiveMaxRows, adaptiveMinRows, pagination, size]);

  useLayoutEffect(() => {
    recalculate();
  }, [recalculate]);

  useEffect(() => {
    const handleResize = () => window.requestAnimationFrame(recalculate);
    window.addEventListener('resize', handleResize);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleResize);
    if (hostRef.current?.parentElement) observer?.observe(hostRef.current.parentElement);
    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [recalculate]);

  const adaptivePagination = useMemo(() => {
    if (pagination === false) return false;
    const configured = pagination && typeof pagination === 'object' ? pagination : {};
    const configuredPageSize = Number(configured.pageSize || configured.defaultPageSize || 0);
    const hasConfiguredPageSize = configuredPageSize > 0;
    // A caller-provided page size is a UI contract. Recalculating it after
    // resize/selection moves rows between pages while their selected keys stay
    // active, which makes a selection appear to leak into the next page.
    const pageSize = hasConfiguredPageSize ? configuredPageSize : adaptivePageSize;

    return {
      showSizeChanger: true,
      showTotal: (count: number) => `共 ${count} 条`,
      ...configured,
      pageSize,
      pageSizeOptions: pageSizeOptions(pageSize, configured.pageSizeOptions),
    } satisfies TablePaginationConfig;
  }, [adaptivePageSize, dataSource, pagination]);

  return (
    <div ref={hostRef} className="admin-adaptive-table">
      <AntTable<RecordType>
        {...props}
        size={size}
        dataSource={dataSource}
        pagination={adaptivePagination}
      />
    </div>
  );
}

export default Table;
