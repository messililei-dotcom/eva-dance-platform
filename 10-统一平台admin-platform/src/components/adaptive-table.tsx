'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Table as AntTable } from 'antd';
import type { AnyObject } from 'antd/es/_util/type';
import type { TableProps } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table/interface';

function pageSizeOptions(current: number, configured?: Array<string | number>) {
  return Array.from(new Set([current, 10, 20, 30, 50, 100, ...(configured || []).map(Number)]))
    .filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b).map(String);
}

export type AdaptiveTableProps<RecordType extends AnyObject = AnyObject> = TableProps<RecordType> & {
  adaptiveMinRows?: number;
  adaptiveMaxRows?: number;
  adaptiveBottomGap?: number;
  adaptiveFillRows?: boolean;
};

export function Table<RecordType extends AnyObject = AnyObject>({
  adaptiveMinRows = 5, adaptiveMaxRows = 100, adaptiveBottomGap = 16,
  adaptiveFillRows = false, pagination, size, dataSource, ...props
}: AdaptiveTableProps<RecordType>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState<number>();
  const [bodyHeight, setBodyHeight] = useState<number>();
  const [embedded, setEmbedded] = useState(false);
  const [selectedSize, setSelectedSize] = useState<number>();
  const [current, setCurrent] = useState(1);
  const manualSize = useRef(false);
  const measuredRows = useRef<{ width: number; height: number }>();
  const lastAutoRequest = useRef<number>();
  const configured = pagination && typeof pagination === 'object' ? pagination : {};
  const configRef = useRef(configured);
  configRef.current = configured;
  // An API-paginated table must request the new slice before displaying its size.
  const controlledSize = configured.pageSize != null && typeof configured.onChange === 'function';

  const recalculate = useCallback(() => {
    const host = hostRef.current;
    if (!host || pagination === false) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width || rect.top >= window.innerHeight) return;
    const container = host.closest('.ant-modal-content, .ant-drawer-content');
    setEmbedded(Boolean(container));
    if (container) return;
    const rows = Array.from(host.querySelectorAll('.ant-table-tbody > tr.ant-table-row'))
      .map(row => row.getBoundingClientRect().height).filter(height => height > 0).sort((a, b) => a - b);
    // A single unusually long first row must not reduce every page's capacity.
    if (rows.length && (!measuredRows.current || measuredRows.current.width !== Math.round(rect.width))) {
      measuredRows.current = { width: Math.round(rect.width), height: rows[Math.floor(rows.length / 2)] };
    }
    const rowHeight = adaptiveFillRows ? 89 : measuredRows.current?.height || (size === 'small' ? 36 : 44);
    const header = host.querySelector('.ant-table-thead')?.getBoundingClientRect().height || 42;
    const pager = host.querySelector('.ant-pagination')?.getBoundingClientRect().height || 32;
    const available = Math.max(rowHeight, window.innerHeight - Math.max(0, rect.top) - header - pager - 32 - adaptiveBottomGap);
    setBodyHeight(Math.floor(available));
    // Round up so the last visible row reaches the bottom; excess rows scroll.
    if (rows.length) setCapacity(Math.min(adaptiveMaxRows, Math.max(adaptiveMinRows, Math.ceil(available / rowHeight))));
  }, [adaptiveBottomGap, adaptiveMaxRows, adaptiveMinRows, adaptiveFillRows, pagination === false, size]);

  useLayoutEffect(() => { recalculate(); }, [recalculate, dataSource, props.columns]);
  useEffect(() => {
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(recalculate); };
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (hostRef.current) observer?.observe(hostRef.current);
    if (hostRef.current?.parentElement) observer?.observe(hostRef.current.parentElement);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); observer?.disconnect(); };
  }, [recalculate]);

  useEffect(() => {
    if (!controlledSize || configRef.current.showSizeChanger === false || embedded || capacity == null || manualSize.current || !dataSource?.length) return;
    if (Number(configRef.current.pageSize) !== capacity && lastAutoRequest.current !== capacity) {
      lastAutoRequest.current = capacity;
      configRef.current.onChange?.(1, capacity);
    }
  }, [capacity, controlledSize, embedded, dataSource?.length]);

  const pageSize = controlledSize ? Number(configured.pageSize) : selectedSize ??
    (embedded ? Number(configured.pageSize || configured.defaultPageSize || 10) : capacity ?? 10);
  const total = Number(configured.total ?? dataSource?.length ?? 0);
  const safeCurrent = Math.min(current, Math.max(1, Math.ceil(total / pageSize)));
  useEffect(() => { setCurrent(safeCurrent); }, [safeCurrent]);
  const adaptivePagination = useMemo(() => {
    if (pagination === false) return false;
    return {
      showSizeChanger: true, showTotal: (count: number) => `共 ${count} 条`, ...configured,
      current: configured.current ?? safeCurrent,
      pageSize, pageSizeOptions: pageSizeOptions(pageSize, configured.pageSizeOptions),
      onChange: (page: number, nextSize: number) => {
        const sizeChanged = nextSize !== pageSize;
        if (sizeChanged) { manualSize.current = true; setSelectedSize(nextSize); }
        const nextPage = sizeChanged ? 1 : page;
        setCurrent(nextPage);
        configured.onChange?.(nextPage, nextSize);
      },
      onShowSizeChange: (page: number, nextSize: number) => {
        manualSize.current = true;
        setSelectedSize(nextSize);
        setCurrent(1);
        configured.onShowSizeChange?.(1, nextSize);
      },
    } satisfies TablePaginationConfig;
  }, [pagination, configured, safeCurrent, pageSize]);

  return (
    <div ref={hostRef} className="admin-adaptive-table">
      <AntTable<RecordType> {...props}
        scroll={pagination !== false && !embedded && bodyHeight ? { ...props.scroll, y: bodyHeight } : props.scroll}
        size={size} dataSource={dataSource} pagination={adaptivePagination} />
    </div>
  );
}

export default Table;
