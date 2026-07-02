import type { ColumnsType, ColumnType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table/interface';
import { isRecord } from '@/lib/data-shape';

type DataIndex = ColumnType<any>['dataIndex'];

function valueByDataIndex(record: unknown, dataIndex: DataIndex): unknown {
  if (!dataIndex) return undefined;
  if (Array.isArray(dataIndex)) {
    return dataIndex.reduce<unknown>((source, key) => {
      if (!isRecord(source)) return undefined;
      return source[String(key)];
    }, record);
  }
  return isRecord(record) ? record[String(dataIndex)] : undefined;
}

function sortableValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;

  const text = String(value).trim();
  const numeric = Number(text.replace(/[¥,\s]/g, ''));
  if (text && Number.isFinite(numeric)) return numeric;

  const timestamp = Date.parse(text);
  if (/^\d{4}-\d{2}-\d{2}/.test(text) && Number.isFinite(timestamp)) return timestamp;

  return text.toLocaleLowerCase();
}

/**
 * 比较两个表格值，支持数字、日期、字符串和混合类型的正确排序。
 *
 * 关键修复：当两个值类型不同（如一个为数字时间戳、另一个为空字符串）时，
 * 不再 fallback 到 String.localeCompare（会产生错误排序），
 * 而是确保类型一致后再比较：
 * - 两个数字 → 数字减法
 * - 两个字符串 → localeCompare
 * - 混合类型 → 数字排在前面（空值/无效值排在末尾）
 */
export function compareTableValues(a: unknown, b: unknown) {
  const left = sortableValue(a);
  const right = sortableValue(b);

  const leftIsNum = typeof left === 'number';
  const rightIsNum = typeof right === 'number';

  // 两个都是数字 → 直接数字比较
  if (leftIsNum && rightIsNum) return left - right;

  // 两个都不是数字（都是字符串）→ localeCompare
  if (!leftIsNum && !rightIsNum) {
    return String(left).localeCompare(String(right), 'zh-CN', { numeric: true, sensitivity: 'base' });
  }

  // 混合类型：数字排在字符串前面
  // 例如日期 "2024-01-15"（数字时间戳）排在 ""（空字符串，非有效日期）之前
  return leftIsNum ? -1 : 1;
}

export function sortableColumns<T extends object>(columns: ColumnsType<T>): ColumnsType<T> {
  return columns.map((column) => {
    if ('children' in column && column.children) {
      return {
        ...column,
        align: column.align ?? 'center',
        children: sortableColumns(column.children as ColumnsType<T>),
      };
    }

    const columnType = column as ColumnType<T>;
    const centeredColumn: ColumnType<T> = {
      ...columnType,
      align: columnType.align ?? 'center',
    };

    if (columnType.sorter || !columnType.dataIndex || columnType.title === '操作') return centeredColumn;

    return {
      ...centeredColumn,
      sorter: (a: T, b: T) => compareTableValues(valueByDataIndex(a, columnType.dataIndex), valueByDataIndex(b, columnType.dataIndex)),
    };
  });
}

export function adminTablePagination(config: TablePaginationConfig = {}): TablePaginationConfig {
  return {
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    showTotal: (total) => `共 ${total} 条`,
    ...config,
  };
}
