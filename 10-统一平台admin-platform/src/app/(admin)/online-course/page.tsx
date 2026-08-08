'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import { Table } from '@/components/adaptive-table';
import { HlsVideo } from '@/components/media/hls-video';
import {
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FolderOutlined,
  AppstoreOutlined,
  LaptopOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  StopOutlined,
  UnorderedListOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload';
import { ensureMediaAuthCookie, onlineCourseApi } from '@/lib/api';
import { platformAdapter } from '@/lib/adapters/platform';
import {
  apiError,
  durationText,
  fileSize,
  materialCover,
  materialIcon,
  materialPreview,
  materialSource,
  imageDisplaySource,
  money,
  pickArray,
  statusTag,
} from '@/lib/online-course-ui';
import { sortableColumns } from '@/lib/table-sort';
import type { Member } from '@/types/domain';

const { Text, Title } = Typography;
const GIB = 1024 * 1024 * 1024;
function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function versionedImageSource(source: string, version?: string | number) {
  if (!source || version === undefined || version === null || version === '') return source;
  const separator = source.includes('?') ? '&' : '?';
  return `${source}${separator}v=${encodeURIComponent(String(version))}`;
}

const MAX_UPLOAD_FILE_SIZE = positiveNumber(process.env.NEXT_PUBLIC_MAX_MATERIAL_UPLOAD_SIZE, 2 * GIB);
const MAX_COURSE_COVER_SIZE = 2 * 1024 * 1024;
const SERIES_PAGE_SIZE_DEFAULT = 30;
const SERIES_PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

type SeriesRow = {
  id: number;
  name: string;
  subtitle?: string;
  category?: string;
  teacher?: string;
  description?: string;
  rich_description?: string;
  cover_image?: string;
  share_image?: string;
  share_text?: string;
  price: number;
  promo_price?: number;
  is_free?: number;
  trial_count?: number;
  status: string;
  total_courses?: number;
  total_students?: number;
  course_count?: number;
  created_at?: string;
  updated_at?: string;
};

type LessonRow = {
  id: number;
  series_id: number;
  series_name?: string;
  name: string;
  description?: string;
  rich_description?: string;
  cover_image?: string;
  share_text?: string;
  course_type?: string;
  type?: string;
  status?: string;
  price?: number;
  single_price?: number;
  local_status?: string;
  video_count?: number;
  duration?: number;
  is_free_trial?: number;
  sort_order?: number;
  videos?: Array<{
    assoc_id?: number;
    id?: number;
    material_id?: number;
    material_name?: string;
    name?: string;
    material_type?: string;
    duration?: number;
  }>;
};

type MaterialRow = {
  id: number;
  name: string;
  type: string;
  folder_id?: number;
  folder_name?: string;
  file_path?: string;
  file_url?: string;
  thumbnail?: string;
  file_size?: number;
  duration?: number;
  uploaded_by?: number | string;
  uploaded_by_name?: string;
  tags?: string;
  transcode_status?: string;
  vod_video_id?: string;
  risk_status?: string;
  is_referenced?: number;
  created_at?: string;
};

type UploadProgressRow = {
  uid: string;
  name: string;
  percent: number;
  status: 'ready' | 'preparing' | 'uploading' | 'processing' | 'done' | 'error' | 'cancelled';
  message?: string;
};

type StorageStats = {
  material_bytes: number;
  material_count: number;
  used_bytes: number;
  total_bytes: number;
  free_bytes: number;
  available_bytes: number;
  path?: string;
};

type FolderRow = {
  id: number;
  name: string;
  parent_id: number;
  material_count?: number;
  merged_ids?: number[];
};

function pickFolderRows(payload: unknown): FolderRow[] {
  if (payload && typeof payload === 'object' && Array.isArray((payload as any).flat)) {
    return (payload as any).flat;
  }
  return pickArray<FolderRow>(payload);
}

const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

const topTabs = ['series', 'materials', 'auth'];
const topTabOrder: Record<string, number> = { series: 0, materials: 1, auth: 2 };

function tabFromOnlineCoursePath(pathname?: string | null) {
  if (pathname === '/online-course/materials' || pathname?.startsWith('/online-course/materials/')) return 'materials';
  if (pathname === '/online-course/auth' || pathname?.startsWith('/online-course/auth/')) return 'auth';
  return 'series';
}

function pathForTopTab(tab: string, seriesId?: number) {
  const path = tab === 'materials' ? '/online-course/materials' : tab === 'auth' ? '/online-course/auth' : '/online-course';
  if (tab === 'auth' && seriesId) return `${path}?seriesId=${seriesId}`;
  return path;
}

const tabMeta: Record<string, { title: string; desc: string; icon: ReactNode }> = {
  materials: { title: '素材中心', desc: '像网盘一样管理视频、音频、PPT、图片素材。', icon: <FolderOutlined /> },
  series: { title: '课程管理', desc: '编辑课程信息、课程主图、价格、分类和上架状态。', icon: <LaptopOutlined /> },
  auth: { title: '学员授权', desc: '管理学员课程访问权限、手机号预授权和订单授权。', icon: <UserSwitchOutlined /> },
};

function folderLabel(folder?: FolderRow) {
  if (!folder) return '根目录文件夹';
  return folder.parent_id === 0 && folder.name === '默认素材' ? '根目录文件夹' : folder.name;
}

function isRootMaterialFolder(folder?: FolderRow) {
  if (!folder) return false;
  const name = String(folder.name || '').trim();
  return Number(folder.parent_id || 0) === 0 && (name === '默认素材' || name === '根目录文件夹');
}

function defaultMaterialFolder(folders: FolderRow[]) {
  return folders.find(item => item.parent_id === 0 && item.name === '默认素材')
    || folders.find(item => isRootMaterialFolder(item))
    || folders.find(item => item.parent_id === 0)
    || folders[0];
}

function folderDescendantIds(folders: FolderRow[], folderId: number) {
  const result = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    folders.forEach(item => {
      const id = Number(item.id);
      const parentId = Number(item.parent_id || 0);
      if (!result.has(id) && (parentId === folderId || result.has(parentId))) {
        result.add(id);
        changed = true;
      }
    });
  }
  return result;
}

function folderSortName(folder: FolderRow) {
  return folderLabel(folder).trim().toLocaleLowerCase('zh-CN');
}

function folderMergedIds(folder?: FolderRow) {
  return Array.from(new Set([folder?.id, ...(folder?.merged_ids || [])]
    .map(value => Number(value || 0))
    .filter(Boolean)));
}

function mergeFoldersByName(folders: FolderRow[]) {
  const groups = new Map<string, FolderRow>();
  const sorted = [...folders].sort((a, b) => {
    if (isRootMaterialFolder(a) !== isRootMaterialFolder(b)) return isRootMaterialFolder(a) ? -1 : 1;
    const nameCompare = folderSortName(a).localeCompare(folderSortName(b), 'zh-CN', { numeric: true, sensitivity: 'base' });
    if (nameCompare !== 0) return nameCompare;
    return Number(a.id || 0) - Number(b.id || 0);
  });

  sorted.forEach(folder => {
    const key = folderSortName(folder);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...folder, merged_ids: [Number(folder.id)] });
      return;
    }
    existing.material_count = Number(existing.material_count || 0) + Number(folder.material_count || 0);
    existing.merged_ids = folderMergedIds(existing).concat(Number(folder.id));
  });

  return Array.from(groups.values())
    .map(folder => ({
      ...folder,
      merged_ids: folderMergedIds(folder),
    }))
    .sort((a, b) => {
      if (isRootMaterialFolder(a) !== isRootMaterialFolder(b)) return isRootMaterialFolder(a) ? -1 : 1;
      const nameCompare = folderSortName(a).localeCompare(folderSortName(b), 'zh-CN', { numeric: true, sensitivity: 'base' });
      if (nameCompare !== 0) return nameCompare;
      return Number(a.id || 0) - Number(b.id || 0);
    });
}

function accessSourceText(record: any) {
  const sharer = record?.share_member_name || record?.referrer_name || record?.distributor_name || record?.inviter_name;
  if (sharer) return `分享：${sharer}`;
  const shareChannel = record?.share_channel || record?.distribution_source;
  if (shareChannel) return `分享：${shareChannel}`;
  if (record?.access_source) return record.access_source;
  const visitSource = record?.visit_source || record?.source;
  if (visitSource === 'auth_request') return '授权申请';
  if (visitSource === 'catalog') return '浏览课节';
  if (visitSource === 'video') return '观看记录';
  if (visitSource === 'learn') return '学习访问';
  if (record?.first_visited_at || record?.visited_at) return '自主搜索/直接访问';
  const authType = record?.auth_type || record?.authorization_type || record?.type;
  if (authType === 'admin_grant') return '后台授权';
  if (authType === 'phone_grant') return '手机号预授权';
  if (authType === 'coupon_grant') return '兑换授权';
  if (record?.member_source && record.member_source !== 'manual') return record.member_source;
  return '-';
}

function normalizeAuthPhone(value: unknown) {
  return String(value || '').trim().replace(/[\s-]/g, '');
}

function extractAuthPhone(value: unknown) {
  const text = String(value || '').trim();
  return normalizeAuthPhone(text.match(/\+?\d[\d\s-]{3,20}\d/)?.[0] || text);
}

function isValidAuthPhone(value: unknown) {
  const phone = extractAuthPhone(value);
  return /^\+?\d{5,20}$/.test(phone);
}

function authActionTime(record: any) {
  return record?.auth_action_at
    || (record?.authorization_status === 'revoked' ? record?.revoked_at : record?.granted_at)
    || record?.granted_at
    || record?.revoked_at
    || record?.last_visited_at
    || record?.first_visited_at
    || record?.visited_at
    || '';
}

function authActionUser(record: any) {
  return record?.auth_action_by_name
    || (record?.authorization_status === 'revoked' ? record?.revoked_by_name : record?.granted_by_name)
    || record?.granted_by_name
    || record?.revoked_by_name
    || '-';
}

function folderNameError(name: string) {
  const value = name.trim();
  if (!value) return '请输入文件夹名称';
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(value)) return '文件夹名称不能包含 \\ / : * ? " < > |';
  if (/[. ]$/.test(value)) return '文件夹名称不能以空格或点结尾';
  if (WINDOWS_RESERVED_NAMES.has(value.toUpperCase())) return '该名称是系统保留名称，请更换';
  return '';
}

function firstMaterial(record: LessonRow) {
  return record.videos?.[0];
}

function captureVideoThumbnail(file: File | string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('浏览器环境不可用'));
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const objectUrl = typeof file === 'string' ? '' : URL.createObjectURL(file);
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = typeof file === 'string' ? file : objectUrl;
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('视频封面生成失败'));
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, Math.max(0, (video.duration || 1) * 0.02));
    };
    video.onseeked = () => {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      cleanup();
      resolve(dataUrl);
    };
  });
}

function uploadFileKey(file: RcFile) {
  return `${file.name.toLowerCase()}_${file.size || 0}`;
}

function asUploadFile(file: unknown): RcFile | null {
  const candidate = ((file as any)?.originFileObj || file) as RcFile | undefined;
  if (!candidate?.name || typeof candidate.size !== 'number') return null;
  // 创建File副本，防止antd清理originFileObj后引用失效
  const cloned = new File([candidate], candidate.name, {
    type: candidate.type || 'application/octet-stream',
    lastModified: candidate.lastModified || Date.now(),
  });
  (cloned as any).uid = (candidate as any).uid || `${candidate.name}_${candidate.size}_${candidate.lastModified || Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  return cloned as unknown as RcFile;
}

function collectUploadFiles(file: unknown, fileList?: unknown[]) {
  const sources = fileList?.length ? fileList : [file];
  return sources.map(asUploadFile).filter(Boolean) as RcFile[];
}

function mergeUploadFiles(prev: RcFile[], files: RcFile[]) {
  const merged = new Map(prev.map(file => [uploadFileKey(file), file]));
  files.forEach(file => merged.set(uploadFileKey(file), file));
  return Array.from(merged.values());
}

function oversizedFileNames(files: Array<{ name: string; size: number }>) {
  return files.filter(file => file.size > MAX_UPLOAD_FILE_SIZE).map(file => file.name);
}

function uploadSizeLimitText() {
  if (MAX_UPLOAD_FILE_SIZE >= GIB) {
    return `${Number((MAX_UPLOAD_FILE_SIZE / GIB).toFixed(1))}GB`;
  }
  return fileSize(MAX_UPLOAD_FILE_SIZE);
}

export default function OnlineCoursePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { message, modal } = App.useApp();
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderTotalRows, setOrderTotalRows] = useState(0);
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(20);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [seriesPage, setSeriesPage] = useState(1);
  const [seriesPageSize, setSeriesPageSize] = useState(SERIES_PAGE_SIZE_DEFAULT);
  const [materialTotalRows, setMaterialTotalRows] = useState(0);
  const [materialPage, setMaterialPage] = useState(1);
  const [materialPageSize, setMaterialPageSize] = useState(20);
  const [materialSortBy, setMaterialSortBy] = useState('created_at');
  const [materialSortOrder, setMaterialSortOrder] = useState<'asc' | 'desc'>('desc');
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | 'all'>('all');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<number[]>([]);
  const [selectedAuthIds, setSelectedAuthIds] = useState<Array<string | number>>([]);
  const [authSeriesId, setAuthSeriesId] = useState<number | 'all'>('all');
  const [authFilter, setAuthFilter] = useState('all');
  const [authorizedStudents, setAuthorizedStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authToggleLoadingKey, setAuthToggleLoadingKey] = useState('');
  const [seriesKeyword, setSeriesKeyword] = useState('');
  const [seriesStatus, setSeriesStatus] = useState('all');
  const [lessonKeyword, setLessonKeyword] = useState('');
  const [authKeyword, setAuthKeyword] = useState('');
  const [materialKeyword, setMaterialKeyword] = useState('');
  const [folderKeyword, setFolderKeyword] = useState('');
  const [materialType, setMaterialType] = useState('all');
  const [lessonStatus, setLessonStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('series');
  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [batchAuthModalOpen, setBatchAuthModalOpen] = useState(false);
  const [authMemberModalOpen, setAuthMemberModalOpen] = useState(false);
  const [authEditingMember, setAuthEditingMember] = useState<Member | null>(null);
  const [authMemberSaving, setAuthMemberSaving] = useState(false);
  const [authDetailOpen, setAuthDetailOpen] = useState(false);
  const [authDetailRecord, setAuthDetailRecord] = useState<any | null>(null);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [batchLessonModalOpen, setBatchLessonModalOpen] = useState(false);
  const [batchMaterialFolderId, setBatchMaterialFolderId] = useState<number | 'all'>('all');
  const [batchMaterialType, setBatchMaterialType] = useState('video');
  const [batchMaterialKeyword, setBatchMaterialKeyword] = useState('');
  const [selectedBatchMaterialIds, setSelectedBatchMaterialIds] = useState<number[]>([]);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<MaterialRow | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [referenceModalOpen, setReferenceModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<SeriesRow | null>(null);
  const [editingLesson, setEditingLesson] = useState<LessonRow | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<MaterialRow | null>(null);
  const [editingFolder, setEditingFolder] = useState<FolderRow | null>(null);
  const [materialViewMode, setMaterialViewMode] = useState<'list' | 'grid'>('list');
  const [lessonViewMode, setLessonViewMode] = useState<'list' | 'grid'>('list');
  const [uploadFiles, setUploadFiles] = useState<RcFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgressRow>>({});
  const [moveFolderId, setMoveFolderId] = useState<number | null>(null);
  const [referenceRows, setReferenceRows] = useState<any[]>([]);
  const [referenceMaterial, setReferenceMaterial] = useState<MaterialRow | null>(null);
  const thumbnailGeneratingIds = useRef(new Set<number>());
  const uploadAbortControllers = useRef(new Map<string, AbortController>());
  const uploadStopRequestedRef = useRef(false);
  const uploadRunningRef = useRef(false);
  const [seriesForm] = Form.useForm();
  const [lessonForm] = Form.useForm();
  const [authForm] = Form.useForm();
  const [batchAuthForm] = Form.useForm();
  const [authMemberForm] = Form.useForm();
  const [materialForm] = Form.useForm();
  const [folderForm] = Form.useForm();
  const seriesCoverImage = Form.useWatch('cover_image', seriesForm);
  const mergedFolders = useMemo(() => mergeFoldersByName(folders), [folders]);
  const selectedMaterialFolder = selectedFolderId === 'all'
    ? undefined
    : mergedFolders.find(item => Number(item.id) === Number(selectedFolderId))
      || folders.find(item => Number(item.id) === Number(selectedFolderId));
  const selectedMaterialFolderIds = folderMergedIds(selectedMaterialFolder);
  const selectedMaterialFolderParam = selectedFolderId === 'all' ? 'all' : selectedMaterialFolderIds.join(',');
  const allMaterialCount = Number(storageStats?.material_count || materialTotalRows || 0);
  const currentMaterialCount = selectedFolderId === 'all'
    ? allMaterialCount
    : Number(selectedMaterialFolder?.material_count || 0);

  const openFolderModal = (parentId?: number) => {
    setEditingFolder(null);
    folderForm.resetFields();
    folderForm.setFieldsValue({ name: '', parent_id: parentId ?? (selectedFolderId === 'all' ? 0 : Number(selectedFolderId)) });
    setFolderModalOpen(true);
  };

  const openEditFolderModal = (folder: FolderRow) => {
    setEditingFolder(folder);
    folderForm.resetFields();
    folderForm.setFieldsValue({ name: folder.name, parent_id: Number(folder.parent_id || 0) });
    setFolderModalOpen(true);
  };

  const loadMaterials = useCallback(async () => {
    const params = {
      page: materialPage,
      pageSize: materialPageSize,
      sort_by: materialSortBy,
      sort_order: materialSortOrder,
      folder_id: selectedMaterialFolderParam,
      type: materialType,
      keyword: materialKeyword.trim(),
    };
    const [materialPayload, storagePayload] = await Promise.all([
      onlineCourseApi.getMaterials(params).catch(() => ({ data: [], total: 0 })),
      onlineCourseApi.getMaterialStorage().catch(() => null),
    ]);
    setMaterials(pickArray(materialPayload));
    setMaterialTotalRows(Number((materialPayload as any)?.total || 0));
    if (storagePayload) setStorageStats(storagePayload);
  }, [materialPage, materialPageSize, materialSortBy, materialSortOrder, selectedMaterialFolderParam, materialType, materialKeyword]);

  const load = () => {
    setLoading(true);
    onlineCourseApi.getSeries()
      .then((seriesPayload) => {
        const nextSeries = pickArray(seriesPayload);
        setSeries(nextSeries);
        const firstId = Number(nextSeries[0]?.id || 0);
        if (!selectedSeriesId && firstId) setSelectedSeriesId(firstId);
      })
      .catch(err => message.error(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    ensureMediaAuthCookie();
    load();
  }, []);

  useEffect(() => {
    if (loading || activeTab !== 'materials') return;
    loadMaterials().catch(err => message.error(apiError(err)));
  }, [activeTab, loadMaterials, loading]);

  useEffect(() => {
    if (activeTab !== 'materials') return;
    onlineCourseApi.getMaterialFolders()
      .then(payload => setFolders(pickFolderRows(payload)))
      .catch(() => setFolders([]));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'auth') return;
    onlineCourseApi.getOrders({ page: orderPage, pageSize: orderPageSize })
      .then((orderPayload) => {
      setOrders(pickArray(orderPayload));
        setOrderTotalRows(Number((orderPayload as any)?.total || pickArray(orderPayload).length));
      })
      .catch(err => message.error(`授权订单加载失败：${apiError(err)}`));
  }, [activeTab, orderPage, orderPageSize]);

  useEffect(() => {
    if (activeTab !== 'auth') return;
    platformAdapter.getMemberDirectory()
      .then(directory => setMembers(directory.members))
      .catch(err => message.error(`学员目录加载失败：${apiError(err)}`));
  }, [activeTab]);

  useEffect(() => {
    setMaterialPage(1);
    setSelectedMaterialIds([]);
  }, [selectedFolderId, materialType, materialKeyword]);

  const syncTabFromUrl = () => {
    const currentPath = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const seriesId = Number(params.get('seriesId') || 0);
    if (seriesId) setSelectedSeriesId(seriesId);
    if (tab === 'lessons') {
      setActiveTab('series');
      router.replace('/online-course');
      return;
    }
    if (tab === 'miniapp') {
      router.replace('/miniprogram');
      return;
    }
    if (tab && topTabs.includes(tab)) {
      setActiveTab(tab);
      if (tab === 'auth') setAuthSeriesId(seriesId || 'all');
      if (currentPath === '/online-course' || currentPath === '/online-course/') {
        router.replace(pathForTopTab(tab, seriesId));
      }
      return;
    }
    const pathTab = tabFromOnlineCoursePath(currentPath);
    setActiveTab(pathTab);
    if (pathTab === 'auth') setAuthSeriesId(seriesId || 'all');
  };

  useEffect(() => {
    syncTabFromUrl();
    const handleTopFeatureChange = (event: Event) => {
      const key = (event as CustomEvent<string>).detail || '';
      if (!key.startsWith('/online-course')) return;
      const url = new URL(key, window.location.origin);
      const params = url.searchParams;
      const tab = params.get('tab');
      const seriesId = Number(params.get('seriesId') || 0);
      if (seriesId) setSelectedSeriesId(seriesId);
      if (tab === 'lessons') {
        setActiveTab('series');
        return;
      }
      if (tab === 'miniapp') {
        router.replace('/miniprogram');
        return;
      }
      const nextTab = tab && topTabs.includes(tab) ? tab : tabFromOnlineCoursePath(url.pathname);
      setActiveTab(nextTab);
      if (nextTab === 'auth') setAuthSeriesId(seriesId || 'all');
      if (tab && topTabs.includes(tab)) {
        router.replace(pathForTopTab(tab, seriesId));
      }
    };
    window.addEventListener('popstate', syncTabFromUrl);
    window.addEventListener('admin-top-feature-change', handleTopFeatureChange);
    return () => {
      window.removeEventListener('popstate', syncTabFromUrl);
      window.removeEventListener('admin-top-feature-change', handleTopFeatureChange);
    };
  }, []);

  useEffect(() => {
    const nextTab = tabFromOnlineCoursePath(pathname);
    setActiveTab(nextTab);
    if (nextTab === 'auth' && typeof window !== 'undefined') {
      const seriesId = Number(new URLSearchParams(window.location.search).get('seriesId') || 0);
      setAuthSeriesId(seriesId || 'all');
    }
  }, [pathname]);

  const loadAuthRows = useCallback(async () => {
    if (!series.length) {
      setAuthorizedStudents([]);
      return;
    }
    const loadBySeries = async () => {
      const results = await Promise.allSettled(series.map(item => (
        onlineCourseApi.getSeriesStudents(item.id, { tab: authFilter })
      )));
      const successful = results.filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled');
      if (!successful.length) {
        const firstFailure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        throw firstFailure?.reason || new Error('授权数据加载失败');
      }
      return results.flatMap((result, index) => {
        if (result.status !== 'fulfilled') return [];
        const sourceSeries = series[index];
        return pickArray(result.value).map(row => ({
          ...row,
          series_id: sourceSeries.id,
          series_name: row.series_name || sourceSeries.name,
          auth_row_key: `${sourceSeries.id}:${row.id || row.phone || row.authorization_id || index}`,
        }));
      });
    };
    if (authSeriesId === 'all') {
      try {
        const payload = await onlineCourseApi.getAllSeriesStudents({ tab: authFilter });
        const rows = pickArray(payload);
        // 汇总接口曾在生产环境异常返回空数据；数据库有课程时以逐课程接口兜底，
        // 防止真实授权被静默渲染成“暂无授权学员”。
        setAuthorizedStudents(rows.length ? rows : await loadBySeries());
      } catch {
        setAuthorizedStudents(await loadBySeries());
      }
      return;
    }
    const sourceSeries = series.find(item => Number(item.id) === Number(authSeriesId));
    const studentPayload = await onlineCourseApi.getSeriesStudents(authSeriesId, { tab: authFilter });
    setAuthorizedStudents(pickArray(studentPayload).map(row => ({
      ...row,
      series_id: authSeriesId,
      series_name: row.series_name || sourceSeries?.name,
      auth_row_key: `${authSeriesId}:${row.id || row.phone || row.authorization_id || ''}`,
    })));
  }, [series, authSeriesId, authFilter]);

  useEffect(() => {
    if (!selectedSeriesId) return;
    Promise.all([
      onlineCourseApi.getSeriesCourses(selectedSeriesId).catch(() => ({ data: [] })),
    ]).then(([coursePayload]) => {
      const lessonRows = pickArray(coursePayload)
        .map(item => ({ ...item, series_id: selectedSeriesId, series_name: series.find(s => s.id === selectedSeriesId)?.name }))
        .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || Number(a.id) - Number(b.id));
      setLessons(lessonRows);
    });
  }, [selectedSeriesId, series]);

  useEffect(() => {
    if (loading || activeTab !== 'auth') return;
    loadAuthRows().catch(err => message.error(apiError(err)));
  }, [loading, activeTab, loadAuthRows]);

  const filteredSeries = useMemo(() => {
    const q = seriesKeyword.trim().toLowerCase();
    return series.filter(item => {
      const matchKeyword = !q || [item.name, item.subtitle, item.category, item.teacher].some(value => String(value || '').toLowerCase().includes(q));
      const matchStatus = seriesStatus === 'all' || item.status === seriesStatus;
      return matchKeyword && matchStatus;
    });
  }, [series, seriesKeyword, seriesStatus]);

  const filteredLessons = useMemo(() => {
    const q = lessonKeyword.trim().toLowerCase();
    return lessons
      .filter(item => {
        const matchKeyword = !q || [item.name, item.series_name, item.type, item.local_status, firstMaterial(item)?.material_name, firstMaterial(item)?.name].some(value => String(value || '').toLowerCase().includes(q));
        const rowStatus = item.local_status || (item as any).status || 'draft';
        const matchStatus = lessonStatus === 'all' || rowStatus === lessonStatus;
        return matchKeyword && matchStatus;
      })
      .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || Number(a.id) - Number(b.id));
  }, [lessons, lessonKeyword, lessonStatus]);

  const filteredAuthorizedStudents = useMemo(() => {
    const q = authKeyword.trim().toLowerCase();
    return authorizedStudents
      .filter(item => {
        const matchStatus = authFilter === 'authorized' ? item.authorized : authFilter === 'unauthorized' ? !item.authorized : true;
        const matchKeyword = !q || [item.name, item.phone, item.series_name, item.auth_type, item.type].some(value => String(value || '').toLowerCase().includes(q));
        return matchStatus && matchKeyword;
      })
      .sort((a, b) => String(authActionTime(b)).localeCompare(String(authActionTime(a))) || Number(b.authorization_id || 0) - Number(a.authorization_id || 0));
  }, [authorizedStudents, authFilter, authKeyword]);

  const findAuthMember = useCallback((record: any): Member | null => {
    const memberId = String(record?.member_id || record?.id || '');
    const phone = normalizeAuthPhone(record?.phone);
    const matched = members.find(item => String(item.id) === memberId)
      || members.find(item => normalizeAuthPhone(item.phone) === phone);
    if (matched) return matched;
    if (!memberId && !phone) return null;
    return {
      id: memberId || String(record?.phone || ''),
      name: record?.name || '',
      phone: record?.phone || '',
      level: record?.level || '普通学员',
      status: record?.status || '正常',
      city: record?.city || '',
      country: record?.country || '中国',
      registerDate: record?.register_date || '',
      totalSpent: 0,
      courseCount: 0,
      growth: 0,
      lastActiveAt: '',
      raw: record,
    };
  }, [members]);

  const openAuthMemberModal = useCallback(async (record: any) => {
    const directoryMember = findAuthMember(record);
    if (!directoryMember?.id) {
      message.warning('未找到该学员档案');
      return;
    }
    const member = await platformAdapter.getMemberRecord(directoryMember.id).catch(() => directoryMember);
    setAuthEditingMember(member);
    authMemberForm.setFieldsValue({
      name: member.name || record?.name || '',
      phone: member.phone || record?.phone || '',
      gender: String(member.raw?.gender || ''),
      level: member.level || '普通学员',
      country: member.country || String(member.raw?.country || '中国'),
      province: String(member.raw?.province || ''),
      city: member.city || String(member.raw?.city || ''),
      address: String(member.raw?.address || ''),
      remark: String(member.raw?.remark || ''),
    });
    setAuthMemberModalOpen(true);
  }, [authMemberForm, findAuthMember, message]);

  const saveAuthMemberProfile = async () => {
    const member = authEditingMember;
    if (!member?.id) {
      message.warning('未找到学员档案，无法保存');
      return;
    }
    const values = await authMemberForm.validateFields();
    setAuthMemberSaving(true);
    try {
      const payload = {
        name: String(values.name || '').trim(),
        phone: String(values.phone || '').trim(),
        gender: values.gender || '',
        level: values.level || '普通学员',
        country: values.country || '中国',
        province: values.province || '',
        city: values.city || '',
        address: values.address || '',
        remark: values.remark || '',
        birthday: String(member.raw?.birthday || ''),
        register_date: String(member.raw?.register_date || member.registerDate || ''),
        avatar: String(member.raw?.avatar || member.avatar || ''),
        previousAvatar: String(member.raw?.avatar || member.avatar || ''),
      };
      await platformAdapter.updateMember(member.id, payload);
      setMembers(prev => prev.map(item => String(item.id) === String(member.id)
        ? {
          ...item,
          name: payload.name,
          phone: payload.phone,
          level: payload.level,
          country: payload.country,
          city: payload.city,
          raw: { ...(item.raw || {}), ...payload },
        }
        : item));
      setAuthorizedStudents(prev => prev.map(row => {
        const sameMember = String(row.member_id || row.id || '') === String(member.id);
        const samePhone = normalizeAuthPhone(row.phone) === normalizeAuthPhone(member.phone);
        return sameMember || samePhone ? { ...row, name: payload.name, phone: payload.phone, level: payload.level } : row;
      }));
      message.success('学员档案已保存');
      setAuthMemberModalOpen(false);
      setAuthEditingMember(null);
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setAuthMemberSaving(false);
    }
  };

  const memberAuthOptions = useMemo(() => members.map(item => ({
    value: `${item.name || '未命名学员'}${item.phone ? ` · ${item.phone}` : ''}`,
    label: `${item.name || '未命名学员'}${item.phone ? ` · ${item.phone}` : ''}`,
    memberId: Number(item.id),
    searchText: `${item.name || ''} ${item.phone || ''}`,
  })), [members]);

  const resolveAuthSubject = (value: unknown, selectedMemberId?: unknown) => {
    const selectedId = Number(selectedMemberId || 0);
    if (selectedId > 0) return { memberId: selectedId, phone: '' };
    const raw = String(value || '').trim();
    const memberMatch = raw.match(/^member:(\d+)$/);
    if (memberMatch) return { memberId: Number(memberMatch[1]), phone: '' };

    const normalized = extractAuthPhone(raw);
    const matchedMember = members.find(item => normalizeAuthPhone(item.phone) === normalized);
    if (matchedMember?.id) return { memberId: Number(matchedMember.id), phone: '' };
    if (isValidAuthPhone(raw)) return { memberId: 0, phone: normalized };
    return { memberId: 0, phone: '' };
  };

  const filteredMaterials = useMemo(() => {
    return materials;
  }, [materials]);

  const filteredFolders = useMemo(() => {
    const q = folderKeyword.trim().toLowerCase();
    if (!q) return mergedFolders;
    return mergedFolders.filter(folder => {
      const parent = folders.find(item => Number(item.id) === Number(folder.parent_id));
      return [folder.name, folderLabel(folder), parent?.name, String(folder.id)]
        .some(value => String(value || '').toLowerCase().includes(q));
    });
  }, [folders, mergedFolders, folderKeyword]);

  useEffect(() => {
    if (activeTab !== 'materials') return;
    const missingThumbnailVideos = filteredMaterials
      .filter(item => item.type === 'video' && !item.thumbnail && !thumbnailGeneratingIds.current.has(item.id))
      .slice(0, 4);
    if (!missingThumbnailVideos.length) return;

    let cancelled = false;
    missingThumbnailVideos.forEach(item => thumbnailGeneratingIds.current.add(item.id));

    (async () => {
      for (const item of missingThumbnailVideos) {
        try {
          const thumbnailDataUrl = await captureVideoThumbnail(`/api/course/materials/${item.id}/file`);
          if (cancelled) return;
          const result = await onlineCourseApi.generateMaterialThumbnail(item.id, { thumbnail_data_url: thumbnailDataUrl });
          const thumbnail = result?.thumbnail || result?.data?.thumbnail;
          if (thumbnail) {
            setMaterials(prev => prev.map(row => row.id === item.id ? { ...row, thumbnail } : row));
          }
        } catch {
          // Keep the fallback play icon when a browser cannot read a particular video.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, filteredMaterials]);

  const coverImageMaterials = useMemo(() => {
    const q = materialKeyword.trim().toLowerCase();
    return materials.filter(item => item.type === 'image' && (!q || [item.name, item.folder_name].some(value => String(value || '').toLowerCase().includes(q))));
  }, [materials, materialKeyword]);

  const batchSelectableMaterials = useMemo(() => {
    const q = batchMaterialKeyword.trim().toLowerCase();
    return materials.filter(item => {
      const matchKeyword = !q || [item.name, item.type, item.folder_name].some(value => String(value || '').toLowerCase().includes(q));
      const matchFolder = batchMaterialFolderId === 'all' || Number(item.folder_id || 0) === Number(batchMaterialFolderId);
      const matchType = batchMaterialType === 'all' || item.type === batchMaterialType;
      return matchKeyword && matchFolder && matchType;
    });
  }, [materials, batchMaterialFolderId, batchMaterialType, batchMaterialKeyword]);

  const currentSeries = series.find(item => item.id === selectedSeriesId);
  const currentAuthSeries = authSeriesId === 'all' ? undefined : series.find(item => Number(item.id) === Number(authSeriesId));
  const totalAuthorizedCount = useMemo(() => (
    series.reduce((sum, item) => sum + Number(item.total_students || 0), 0)
  ), [series]);
  const lessonStats = useMemo(() => ({
    total: lessons.length,
    duration: lessons.reduce((sum, item) => sum + Number(item.duration || firstMaterial(item)?.duration || 0), 0),
    published: lessons.filter(item => ['published', 'active'].includes(item.local_status || item.status || '')).length,
  }), [lessons]);
  const currentMeta = tabMeta[activeTab] || tabMeta.series;
  const currentMaterialFolder = selectedFolderId === 'all'
    ? undefined
    : selectedMaterialFolder;
  const currentMaterialFolderName = selectedFolderId === 'all'
    ? '全部素材'
    : folderLabel(currentMaterialFolder);
  const uploadProgressRows = Object.values(uploadProgress);
  const uploadActiveCount = uploadProgressRows.filter(item => ['preparing', 'uploading'].includes(item.status)).length;
  const isUploadingMaterials = uploadActiveCount > 0;
  const uploadTargetFolderName = folderLabel(selectedFolderId === 'all' ? defaultMaterialFolder(folders) : folders.find(item => item.id === selectedFolderId));
  const sortTitle = (label: string, key: string) => (
    <span>{label}{materialSortBy === key ? (materialSortOrder === 'asc' ? ' ▲' : ' ▼') : ''}</span>
  );

  const openSeriesModal = (record?: SeriesRow) => {
    setEditingSeries(record || null);
    seriesForm.resetFields();
    seriesForm.setFieldsValue(record ? {
      ...record,
      cover_image: record.cover_image || '',
      teacher: record.teacher || '',
      price: Number(record.price || 0),
      promo_price: Number(record.promo_price || 0),
      trial_count: Number(record.trial_count || 0),
      is_free: Boolean(record.is_free),
      status: record.status || 'draft',
    } : {
      name: '',
      subtitle: '',
      description: '',
      rich_description: '',
      cover_image: '',
      teacher: '伊娃',
      status: 'draft',
      price: 0,
      promo_price: 0,
      trial_count: 0,
      is_free: false,
    });
    setSeriesModalOpen(true);
  };

  const openLessonModal = (record?: LessonRow) => {
    setEditingLesson(record || null);
    lessonForm.setFieldsValue(record ? {
      ...record,
      local_status: record.local_status || record.status || 'draft',
      type: record.course_type || record.type || 'recorded',
      price: record.single_price ?? record.price ?? 0,
      material_id: firstMaterial(record)?.material_id || firstMaterial(record)?.id,
      is_free_trial: Boolean(record.is_free_trial),
    } : {
      series_id: selectedSeriesId,
      type: 'recorded',
      price: 0,
      local_status: 'draft',
      sort_order: (lessons.at(-1)?.sort_order || lessons.length) + 1,
      is_free_trial: false,
    });
    setLessonModalOpen(true);
  };

  const openCoverPicker = async () => {
    setCoverPickerOpen(true);
    try {
      const payload = await onlineCourseApi.getMaterials({ page: 1, pageSize: 200, type: 'image' });
      const rows = pickArray(payload);
      setMaterials(prev => {
        const byId = new Map(prev.map(item => [item.id, item]));
        rows.forEach(item => byId.set(item.id, item));
        return Array.from(byId.values());
      });
    } catch (err) {
      message.error(apiError(err));
    }
  };

  const persistSeriesCoverImage = async (source: string, silent = false) => {
    seriesForm.setFieldValue('cover_image', source);
    if (!silent) message.success('已填入课程主图，点击确定保存');
  };

  const uploadSeriesCoverImage = async (file: RcFile) => {
    if (!file.type?.startsWith('image/')) {
      message.warning('请选择图片文件');
      return;
    }
    if (file.size > MAX_COURSE_COVER_SIZE) {
      message.error('图片太大，不能超过2M');
      return;
    }
    setCoverUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('courseName', seriesForm.getFieldValue('name') || editingSeries?.name || '课程主图');
      const result = await onlineCourseApi.uploadSeriesCover(formData);
      const source = result?.data?.coverImage || result?.coverImage;
      if (!source) throw new Error('上传成功，但没有返回图片地址');
      await persistSeriesCoverImage(source, true);
      setCoverPickerOpen(false);
      message.success('图片已上传并填入课程主图，点击确定保存');
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setCoverUploading(false);
    }
  };

  const openBatchLessonModal = async () => {
    if (!selectedSeriesId) {
      message.warning('请先选择课程');
      return;
    }
    setBatchLessonModalOpen(true);
    setSelectedBatchMaterialIds([]);
    try {
      const payload = await onlineCourseApi.getMaterials({ page: 1, pageSize: 200, type: batchMaterialType });
      const rows = pickArray(payload);
      setMaterials(prev => {
        const byId = new Map(prev.map(item => [item.id, item]));
        rows.forEach(item => byId.set(item.id, item));
        return Array.from(byId.values());
      });
    } catch (err) {
      message.error(apiError(err));
    }
  };

  const openMaterialModal = (record?: MaterialRow) => {
    setEditingMaterial(record || null);
    materialForm.setFieldsValue(record || { type: 'video', folder_id: selectedFolderId === 'all' ? folders[0]?.id : selectedFolderId, file_size: 0, duration: 0, transcode_status: 'completed' });
    setMaterialModalOpen(true);
  };

  const openMaterialPreview = (record: MaterialRow) => {
    ensureMediaAuthCookie();
    setPreviewError('');
    setPreviewMaterial(record);
  };

  const openUploadModal = () => {
    uploadStopRequestedRef.current = false;
    uploadAbortControllers.current.clear();
    setUploadFiles([]);
    setUploadProgress({});
    setUploadModalOpen(true);
  };

  const resetUploadModal = () => {
    uploadStopRequestedRef.current = false;
    uploadAbortControllers.current.clear();
    setUploadFiles([]);
    setUploadProgress({});
    setUploadModalOpen(false);
  };

  const stopMaterialUploads = () => {
    uploadStopRequestedRef.current = true;
    uploadAbortControllers.current.forEach(controller => controller.abort());
    setUploadProgress(prev => {
      const next = { ...prev };
      uploadFiles.forEach(file => {
        const current = next[file.uid] || { uid: file.uid, name: file.name, percent: 0, status: 'ready' as const };
        if (['ready', 'preparing', 'uploading'].includes(current.status)) {
          next[file.uid] = { ...current, status: 'cancelled', message: '已停止上传' };
        }
      });
      return next;
    });
    message.info('已停止上传，正在整理已完成的素材');
  };

  const closeUploadModal = () => {
    if (isUploadingMaterials) {
      stopMaterialUploads();
      return;
    }
    resetUploadModal();
  };

  const addUploadFiles = (files: RcFile[]) => {
    if (!files.length) return;
    const tooLarge = oversizedFileNames(files);
    if (tooLarge.length) {
      message.error(`单文件不得超过${uploadSizeLimitText()}：${tooLarge.slice(0, 3).join('、')}${tooLarge.length > 3 ? ' 等' : ''}`);
    }
    const validFiles = files.filter(file => file.size <= MAX_UPLOAD_FILE_SIZE);
    if (!validFiles.length) return;
    const nextFiles = mergeUploadFiles(uploadFiles, validFiles);
    const skipped = uploadFiles.length + validFiles.length - nextFiles.length;
    setUploadFiles(nextFiles);
    if (skipped > 0) {
      message.warning(`已自动忽略 ${skipped} 个重复选择的素材`);
    }
  };

  const saveSeries = async () => {
    const values = await seriesForm.validateFields();
    setSaving(true);
    try {
      const name = String(values.name || '').trim();
      if (!name) {
        message.warning('请输入课程名称');
        return;
      }
      const payload = {
        name,
        subtitle: String(values.subtitle || '').trim(),
        description: values.description || '',
        rich_description: values.rich_description || '',
        cover_image: values.cover_image || '',
        teacher: String(values.teacher || '').trim(),
        status: values.status || 'draft',
        price: Number(values.price || 0),
        promo_price: Number(values.promo_price || 0),
        share_image: editingSeries?.share_image || '',
        category: editingSeries?.category || '',
        trial_count: Number(values.trial_count ?? editingSeries?.trial_count ?? 0),
        is_free: values.is_free ? 1 : 0,
        share_text: editingSeries?.share_text || '',
      };
      const result = editingSeries
        ? await onlineCourseApi.updateSeries(editingSeries.id, payload)
        : await onlineCourseApi.createSeries(payload);
      const savedSeries = result?.data || result?.series || null;
      message.success(editingSeries ? '课程已更新' : '课程已新建');
      setSeriesModalOpen(false);
      seriesForm.resetFields();
      if (savedSeries?.id) {
        const nextRow = { ...(editingSeries || {}), ...savedSeries };
        setSeries(prev => editingSeries
          ? prev.map(item => item.id === editingSeries.id ? { ...item, ...nextRow } : item)
          : [nextRow as SeriesRow, ...prev]);
        setEditingSeries(null);
      } else {
        await load();
      }
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const replaceLessonMaterial = async (lessonId: number, materialId?: number) => {
    if (!materialId) return;
    const current = pickArray(await onlineCourseApi.getCourseMaterials(lessonId).catch(() => ({ data: [] })));
    await Promise.all(current.map(item => onlineCourseApi.removeCourseMaterial(lessonId, item.assoc_id || item.id)));
    await onlineCourseApi.addCourseMaterial(lessonId, { material_id: materialId });
  };

  const saveLesson = async () => {
    const values = await lessonForm.validateFields();
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        description: values.description || '',
        rich_description: values.rich_description || '',
        cover_image: values.cover_image || '',
        share_text: values.share_text || '',
        series_id: values.series_id || selectedSeriesId,
        status: values.local_status,
        local_status: values.local_status,
        course_type: values.type || values.course_type || 'recorded',
        type: values.type || values.course_type || 'recorded',
        single_price: Number(values.price || values.single_price || 0),
        price: Number(values.price || values.single_price || 0),
        sort_order: Number(values.sort_order || editingLesson?.sort_order || (lessons.at(-1)?.sort_order || lessons.length) + 1),
        is_free_trial: values.is_free_trial ? 1 : 0,
      };
      let saved: any;
      if (editingLesson) saved = await onlineCourseApi.updateCourse(editingLesson.id, payload);
      else saved = await onlineCourseApi.createCourse(payload);
      const savedId = editingLesson?.id || saved?.data?.id || saved?.id;
      if (savedId && values.material_id) await replaceLessonMaterial(savedId, values.material_id);
      message.success(editingLesson ? '课节已更新' : '课节已新建');
      setLessonModalOpen(false);
      if (selectedSeriesId) {
        const payload = await onlineCourseApi.getSeriesCourses(selectedSeriesId).catch(() => ({ data: [] }));
        setLessons(
          pickArray(payload)
            .map(item => ({ ...item, series_id: selectedSeriesId }))
            .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || Number(a.id) - Number(b.id))
        );
      }
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const saveLessonSort = async (record: LessonRow, sortOrder: number | null) => {
    if (!sortOrder || sortOrder === record.sort_order) return;
    try {
      await onlineCourseApi.updateCourse(record.id, { ...record, sort_order: sortOrder, status: record.local_status || record.status || 'draft' });
      message.success('排序已更新');
      if (selectedSeriesId) {
        const payload = await onlineCourseApi.getSeriesCourses(selectedSeriesId).catch(() => ({ data: [] }));
        setLessons(
          pickArray(payload)
            .map(item => ({ ...item, series_id: selectedSeriesId }))
            .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || Number(a.id) - Number(b.id))
        );
      }
    } catch (err) {
      message.error(apiError(err));
    }
  };

  const batchCreateLessonsFromMaterials = async () => {
    if (!selectedSeriesId || !selectedBatchMaterialIds.length) {
      message.warning('请选择课程和素材');
      return;
    }
    setSaving(true);
    try {
      const result = await onlineCourseApi.batchCreateCourses({ series_id: selectedSeriesId, material_ids: selectedBatchMaterialIds });
      message.success(`已生成 ${result?.count || selectedBatchMaterialIds.length} 个课节`);
      setSelectedBatchMaterialIds([]);
      setBatchLessonModalOpen(false);
      const payload = await onlineCourseApi.getSeriesCourses(selectedSeriesId).catch(() => ({ data: [] }));
      setLessons(
        pickArray(payload)
          .map(item => ({ ...item, series_id: selectedSeriesId, series_name: currentSeries?.name }))
          .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || Number(a.id) - Number(b.id))
      );
      load();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const saveAuthorization = async () => {
    const values = await authForm.validateFields();
    const subject = resolveAuthSubject(values.member_lookup, values.member_lookup_id);
    if (!subject.memberId && !subject.phone) {
      message.warning('请选择学员，或输入手机号进行授权');
      return;
    }
    setSaving(true);
    try {
      if (subject.memberId) await onlineCourseApi.authorizeMember(values.series_id, { member_id: subject.memberId, type: 'admin_grant', remark: values.remark || '' });
      else await onlineCourseApi.authorizePhone(values.series_id, { phone: subject.phone, type: 'admin_grant', remark: values.remark || '' });
      message.success('授权已生效');
      setAuthModalOpen(false);
      setAuthSeriesId(Number(values.series_id));
      await loadAuthRows();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const saveBatchCourseAuthorization = async () => {
    const values = await batchAuthForm.validateFields();
    const seriesIds = Array.isArray(values.series_ids) ? values.series_ids.filter(Boolean) : [];
    const subject = resolveAuthSubject(values.member_lookup, values.member_lookup_id);
    if (!subject.memberId && !subject.phone) {
      message.warning('请选择学员，或输入手机号进行授权');
      return;
    }
    if (!seriesIds.length) {
      message.warning('请选择要授权的课程');
      return;
    }

    setSaving(true);
    try {
      if (subject.memberId) {
        await Promise.all(seriesIds.map((seriesId: number) => (
          onlineCourseApi.authorizeMember(seriesId, {
            member_id: subject.memberId,
            type: 'admin_grant',
            remark: values.remark || '',
          })
        )));
      } else {
        await Promise.all(seriesIds.map((seriesId: number) => (
          onlineCourseApi.authorizePhone(seriesId, {
            phone: subject.phone,
            type: 'admin_grant',
            remark: values.remark || '',
          })
        )));
      }
      message.success(`已批量授权 ${seriesIds.length} 门课程`);
      setBatchAuthModalOpen(false);
      batchAuthForm.resetFields();
      await loadAuthRows();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const batchAuthorizeSelected = async () => {
    if (authSeriesId === 'all' || selectedAuthIds.length === 0) return;
    setSaving(true);
    try {
      const member_ids = selectedAuthIds.map(id => Number(id)).filter(Boolean);
      await onlineCourseApi.batchAuthorizeMembers(authSeriesId, { member_ids, type: 'admin_grant' });
      message.success(`已授权 ${member_ids.length} 位学员`);
      setSelectedAuthIds([]);
      await loadAuthRows();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const batchCancelAuthorization = () => {
    if (authSeriesId === 'all' || selectedAuthIds.length === 0) return;
    const selectedKeys = new Set(selectedAuthIds.map(String));
    const rows = filteredAuthorizedStudents.filter(record => selectedKeys.has(String(record.id || record.phone)) && record.authorized);
    if (!rows.length) {
      message.warning('请选择已授权的学员');
      return;
    }
    modal.confirm({
      title: `确定取消 ${rows.length} 位学员的授权吗？`,
      content: '取消后，所选学员将无法继续访问该课程。',
      okText: '取消授权',
      okButtonProps: { danger: true },
      cancelText: '返回',
      onOk: async () => {
        setSaving(true);
        try {
          await Promise.all(rows.map(record => onlineCourseApi.deauthorizeMember(authSeriesId, { member_id: record.id, phone: record.phone })));
          message.success(`已取消 ${rows.length} 位学员授权`);
          setSelectedAuthIds([]);
          await loadAuthRows();
        } catch (err) {
          message.error(apiError(err));
          throw err;
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const authorizationRowKey = (record: any) => (
    String(record.auth_row_key || `${record.series_id || authSeriesId}:${record.id || record.phone}`)
  );

  const cancelAuthorization = (record: any) => {
    modal.confirm({
      title: '确定撤销此学员授权吗？',
      okText: '撤销',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const rowKey = authorizationRowKey(record);
        setAuthToggleLoadingKey(rowKey);
        try {
          await onlineCourseApi.deauthorizeMember(authSeriesId === 'all' ? record.series_id : authSeriesId, { member_id: record.id, phone: record.phone });
          message.success('已撤销授权');
          await loadAuthRows();
        } catch (err) {
          message.error(apiError(err));
          throw err;
        } finally {
          setAuthToggleLoadingKey('');
        }
      },
    });
  };

  const toggleAuthorization = (record: any, nextAuthorized: boolean) => {
    if (Boolean(record.authorized) === nextAuthorized) return;
    if (!nextAuthorized) {
      cancelAuthorization(record);
      return;
    }
    const seriesId = authSeriesId === 'all' ? record.series_id : authSeriesId;
    if (!seriesId) {
      message.warning('请先选择课程');
      return;
    }
    modal.confirm({
      title: '确定授权此学员吗？',
      content: `${record.name || record.phone || '该学员'} 将获得「${record.series_name || currentAuthSeries?.name || '当前课程'}」访问权限。`,
      okText: '授权',
      cancelText: '取消',
      onOk: async () => {
        const rowKey = authorizationRowKey(record);
        setAuthToggleLoadingKey(rowKey);
        try {
          await onlineCourseApi.authorizeMember(seriesId, { member_id: record.id, type: 'admin_grant' });
          message.success('已授权');
          await loadAuthRows();
        } catch (err) {
          message.error(apiError(err));
          throw err;
        } finally {
          setAuthToggleLoadingKey('');
        }
      },
    });
  };

  const batchUpdateLessons = async (nextStatus: string) => {
    if (!selectedLessonIds.length) return;
    setSaving(true);
    try {
      await onlineCourseApi.batchUpdateCourseStatus({ ids: selectedLessonIds, status: nextStatus });
      message.success(nextStatus === 'published' ? '已批量上架' : '已批量下架');
      setSelectedLessonIds([]);
      if (selectedSeriesId) {
        const payload = await onlineCourseApi.getSeriesCourses(selectedSeriesId).catch(() => ({ data: [] }));
        setLessons(
          pickArray(payload)
            .map(item => ({ ...item, series_id: selectedSeriesId }))
            .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || Number(a.id) - Number(b.id))
        );
      }
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const batchDeleteLessons = () => {
    if (!selectedLessonIds.length) return;
    confirmDelete(`确定删除选中的 ${selectedLessonIds.length} 个课节吗？`, async () => {
      await onlineCourseApi.batchDeleteCourses({ ids: selectedLessonIds });
      setSelectedLessonIds([]);
    });
  };

  const saveMaterial = async () => {
    const values = await materialForm.validateFields();
    setSaving(true);
    try {
      if (editingMaterial) await onlineCourseApi.updateMaterial(editingMaterial.id, values);
      else await onlineCourseApi.createMaterial(values);
      message.success(editingMaterial ? '素材已更新' : '素材已创建');
      setMaterialModalOpen(false);
      await loadMaterials();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const regenerateEditingThumbnail = async () => {
    if (!editingMaterial) return;
    const source = editingMaterial.file_path || editingMaterial.file_url;
    if (!source) {
      message.warning('当前素材没有可读取的视频地址');
      return;
    }
    setSaving(true);
    try {
      const thumbnailDataUrl = await captureVideoThumbnail(`/api/course/materials/${editingMaterial.id}/file`);
      const result = await onlineCourseApi.generateMaterialThumbnail(editingMaterial.id, { thumbnail_data_url: thumbnailDataUrl });
      materialForm.setFieldValue('thumbnail', result.thumbnail);
      setEditingMaterial(prev => prev ? { ...prev, thumbnail: result.thumbnail } : prev);
      message.success('缩略图已生成');
      await loadMaterials();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadLocalMaterials = async () => {
    if (uploadRunningRef.current) {
      message.info('素材正在上传中，请勿重复点击');
      return;
    }
    if (!uploadFiles.length) {
      message.warning('请选择要上传的素材文件');
      return;
    }
    const tooLarge = oversizedFileNames(uploadFiles);
    if (tooLarge.length) {
      message.error(`单文件不得超过${uploadSizeLimitText()}：${tooLarge.slice(0, 3).join('、')}${tooLarge.length > 3 ? ' 等' : ''}`);
      return;
    }
    uploadRunningRef.current = true;
    setSaving(true);
    uploadStopRequestedRef.current = false;
    try {
      const filesToUpload = [...uploadFiles];
      const targetFolder = selectedFolderId === 'all'
        ? defaultMaterialFolder(folders)
        : folders.find(item => Number(item.id) === Number(selectedFolderId));
      const folderId = targetFolder?.id || 0;
      setUploadProgress(Object.fromEntries(filesToUpload.map(file => [file.uid, { uid: file.uid, name: file.name, percent: 0, status: 'ready' as const }])));

      const isCancelledError = (err: any) => Boolean(
        uploadStopRequestedRef.current
        || err?.name === 'CanceledError'
        || err?.code === 'ERR_CANCELED'
        || String(err?.message || '').toLowerCase() === 'canceled'
      );
      const uploadOne = async (file: RcFile) => {
        if (uploadStopRequestedRef.current) throw Object.assign(new Error('已停止上传'), { cancelled: true });
        setUploadProgress(prev => ({ ...prev, [file.uid]: { ...(prev[file.uid] || { uid: file.uid, name: file.name, percent: 0 }), status: 'preparing', percent: 2 } }));
        const formData = new FormData();
        formData.append('files', file);
        formData.append('folder_id', String(folderId));
        if (uploadStopRequestedRef.current) throw Object.assign(new Error('已停止上传'), { cancelled: true });
        setUploadProgress(prev => ({ ...prev, [file.uid]: { ...(prev[file.uid] || { uid: file.uid, name: file.name, percent: 0 }), status: 'uploading', percent: Math.max(prev[file.uid]?.percent || 0, 5) } }));
        const controller = new AbortController();
        uploadAbortControllers.current.set(file.uid, controller);
        const result = await onlineCourseApi.uploadLocalMaterials(formData, {
          signal: controller.signal,
          onUploadProgress: (event: any) => {
            const total = event.total || file.size || 1;
            if (event.loaded >= total) {
              setUploadProgress(prev => ({ ...prev, [file.uid]: { ...(prev[file.uid] || { uid: file.uid, name: file.name, percent: 0 }), status: 'uploading', percent: Math.max(prev[file.uid]?.percent || 0, 95) } }));
              return;
            }
            const percent = Math.min(90, Math.round((event.loaded / total) * 90));
            setUploadProgress(prev => ({ ...prev, [file.uid]: { ...(prev[file.uid] || { uid: file.uid, name: file.name, percent: 0 }), status: 'uploading', percent } }));
          },
        }).finally(() => {
          uploadAbortControllers.current.delete(file.uid);
        });
        setUploadProgress(prev => ({ ...prev, [file.uid]: { ...(prev[file.uid] || { uid: file.uid, name: file.name, percent: 0 }), status: 'done', percent: 100 } }));
        return result;
      };

      const uploadResults: Array<
        | { status: 'fulfilled'; value: any }
        | { status: 'rejected'; reason: unknown }
        | { status: 'cancelled'; reason: unknown }
      > = new Array(filesToUpload.length);
      let cursor = 0;
      const workerCount = 1; // 串行上传，避免并发导致内存暴涨
      const workers = Array.from({ length: workerCount }, async () => {
        while (cursor < filesToUpload.length && !uploadStopRequestedRef.current) {
          const index = cursor;
          cursor += 1;
          const file = filesToUpload[index];
          try {
            const value = await uploadOne(file);
            uploadResults[index] = { status: 'fulfilled', value };
          } catch (err) {
            if (isCancelledError(err) || (err as any)?.cancelled) {
              uploadResults[index] = { status: 'cancelled', reason: err };
              setUploadProgress(prev => ({ ...prev, [file.uid]: { ...(prev[file.uid] || { uid: file.uid, name: file.name, percent: 0 }), status: 'cancelled', message: '已停止上传' } }));
            } else {
              uploadResults[index] = { status: 'rejected', reason: err };
              setUploadProgress(prev => ({ ...prev, [file.uid]: { ...(prev[file.uid] || { uid: file.uid, name: file.name, percent: 0 }), status: 'error', message: apiError(err) } }));
            }
          }
        }
      });
      await Promise.all(workers);
      filesToUpload.forEach((file, index) => {
        if (!uploadResults[index]) {
          uploadResults[index] = { status: 'cancelled', reason: new Error('已停止上传') };
          setUploadProgress(prev => ({ ...prev, [file.uid]: { ...(prev[file.uid] || { uid: file.uid, name: file.name, percent: 0 }), status: 'cancelled', message: '已停止上传' } }));
        }
      });

      const succeeded = uploadResults.filter(r => r.status === 'fulfilled').length;
      const failed = uploadResults.filter(r => r.status === 'rejected').length;
      const cancelled = uploadResults.filter(r => r.status === 'cancelled').length;
      const failedMessages = uploadResults
        .filter((r): r is { status: 'rejected'; reason: unknown } => r.status === 'rejected')
        .map(r => apiError(r.reason));
      const warningMessages = uploadResults
        .filter((r): r is { status: 'fulfilled'; value: any } => r.status === 'fulfilled')
        .flatMap(r => Array.isArray(r.value?.warnings) ? r.value.warnings : [])
        .map(item => item?.message || '')
        .filter(Boolean);

      if (succeeded > 0) {
        await loadMaterials();
        if (cancelled > 0) {
          message.info(`已停止上传：成功 ${succeeded} 个，未完成 ${cancelled + failed} 个${failed ? `，失败 ${failed} 个` : ''}`);
          setUploadFiles(filesToUpload.filter((_, index) => uploadResults[index].status !== 'fulfilled'));
          return;
        } else if (failed > 0) {
          message.warning(`上传完成：成功 ${succeeded} 个，失败 ${failed} 个。${failedMessages[0] || ''}`);
          setUploadFiles(filesToUpload.filter((_, index) => uploadResults[index].status === 'rejected'));
          return;
        } else if (warningMessages.length) {
          message.warning(`已上传 ${succeeded} 个素材；${warningMessages[0]}`);
        } else {
          message.success(`已上传 ${succeeded} 个素材`);
        }
        setUploadFiles([]);
        setUploadModalOpen(false);
        setUploadProgress({});
      } else {
        if (cancelled > 0 && failed === 0) {
          await loadMaterials();
          message.info('上传已停止');
        } else {
          await loadMaterials();
          message.error(failedMessages[0] || '全部上传失败');
        }
      }
    } catch (err) {
      message.error(apiError(err));
    } finally {
      uploadAbortControllers.current.clear();
      uploadRunningRef.current = false;
      setSaving(false);
    }
  };

  const batchMoveSelectedMaterials = async () => {
    if (!selectedMaterialIds.length || !moveFolderId) return;
    setSaving(true);
    try {
      await onlineCourseApi.batchMoveMaterials({ ids: selectedMaterialIds, folder_id: moveFolderId });
      const target = folders.find(item => item.id === moveFolderId);
      message.success(`已移动 ${selectedMaterialIds.length} 个素材到「${target?.name || '目标文件夹'}」`);
      setSelectedMaterialIds([]);
      setMoveModalOpen(false);
      setMoveFolderId(null);
      load();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openMaterialReferences = async (record: MaterialRow) => {
    setReferenceMaterial(record);
    setReferenceRows([]);
    setReferenceModalOpen(true);
    try {
      const payload = await onlineCourseApi.getMaterialReferences(record.id);
      setReferenceRows(pickArray(payload));
    } catch (err) {
      message.error(apiError(err));
    }
  };

  const cancelMaterialReference = (record: any) => {
    if (!referenceMaterial?.id || !record.id) return;
    modal.confirm({
      title: '确定取消此素材引用吗？',
      content: `素材将从「${record.course_name || record.name || '该课节'}」中移除，不会删除素材文件本身。`,
      okText: '取消引用',
      okButtonProps: { danger: true },
      cancelText: '保留',
      onOk: async () => {
        setSaving(true);
        try {
          await onlineCourseApi.removeMaterialReference(referenceMaterial.id, record.id);
          const payload = await onlineCourseApi.getMaterialReferences(referenceMaterial.id);
          setReferenceRows(pickArray(payload));
          await loadMaterials();
          message.success('已取消引用');
        } catch (err) {
          message.error(apiError(err));
          throw err;
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const saveFolder = async (formValues?: any) => {
    const values = formValues || await folderForm.validateFields();
    const name = String(values.name || '').trim();
    const nameError = folderNameError(name);
    if (nameError) {
      message.error(nameError);
      return;
    }
    const parentId = Number(values.parent_id || 0);
    if (editingFolder) {
      const blockedParentIds = folderDescendantIds(folders, Number(editingFolder.id));
      blockedParentIds.add(Number(editingFolder.id));
      if (blockedParentIds.has(parentId)) {
        message.error('不能把文件夹移动到自身或子文件夹下');
        return;
      }
    }
    if (folders.some(item => Number(item.id) !== Number(editingFolder?.id) && Number(item.parent_id || 0) === parentId && item.name.trim().toLowerCase() === name.toLowerCase())) {
      message.error('同一文件夹下已存在同名文件夹');
      return;
    }
    setSaving(true);
    try {
      const result = editingFolder
        ? await onlineCourseApi.updateMaterialFolder(editingFolder.id, { name, parent_id: parentId })
        : await onlineCourseApi.createMaterialFolder({ name, parent_id: parentId });
      if (result?.success === false) throw new Error(result?.message || (editingFolder ? '文件夹更新失败' : '文件夹创建失败'));
      const created = result?.data || result;
      message.success(editingFolder ? '文件夹已更新' : '文件夹已创建');
      setFolderModalOpen(false);
      folderForm.resetFields();
      setEditingFolder(null);
      if (!editingFolder && created?.id) {
        setFolders(prev => prev.some(item => item.id === created.id) ? prev : [...prev, created]);
        setSelectedFolderId(created.id);
      }
      const folderPayload = await onlineCourseApi.getMaterialFolders().catch(() => ({ flat: [] }));
      setFolders(pickFolderRows(folderPayload));
      const materialPayload = await onlineCourseApi.getMaterials({
        page: materialPage,
        pageSize: materialPageSize,
        sort_by: materialSortBy,
        sort_order: materialSortOrder,
        folder_id: selectedMaterialFolderParam,
        type: materialType,
        keyword: materialKeyword.trim(),
      }).catch(() => ({ data: [] }));
      setMaterials(pickArray(materialPayload));
      setMaterialTotalRows(Number((materialPayload as any)?.total || 0));
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteCurrentFolder = () => {
    if (!currentMaterialFolder) return;
    confirmDelete(`确定删除文件夹「${folderLabel(currentMaterialFolder)}」吗？文件夹内存在素材或子文件夹时可能无法删除。`, async () => {
      await onlineCourseApi.deleteMaterialFolder(currentMaterialFolder.id);
      setSelectedFolderId('all');
    });
  };

  const confirmDelete = (title: string, onOk: () => Promise<any>) => {
    modal.confirm({
      title,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await onOk();
          message.success('已删除');
          load();
        } catch (err) {
          message.error(apiError(err));
          throw err;
        }
      },
    });
  };

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div className="online-course-replica">
      <div className="oc-topbar">
        <div>
          <Title level={2}>{currentMeta.title}</Title>
          <Text>{currentMeta.desc}</Text>
        </div>
	        <Space wrap>
	          {activeTab === 'series' && <Button type="primary" icon={<PlusOutlined />} onClick={() => openSeriesModal()}>新建课程</Button>}
	        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          const nextPath = pathForTopTab(key);
          router.replace(nextPath);
          window.dispatchEvent(new CustomEvent('admin-top-feature-change', { detail: nextPath }));
        }}
        className="oc-tabs"
        tabBarStyle={{ display: 'none' }}
        items={[
          {
            key: 'materials',
            label: <span>{tabMeta.materials.icon} 素材中心 {materialTotalRows || filteredMaterials.length}</span>,
            children: (
              <Row className="oc-material-layout" gutter={[16, 16]}>
                <Col className="oc-material-folder-col" flex="0 0 300px" style={{ maxWidth: '100%' }}>
                  <Card
                    className="oc-material-folder-card"
                    title="素材文件夹"
                    extra={
                      <Space size={4}>
                        <Tooltip title="新建文件夹">
                          <Button size="small" icon={<PlusOutlined />} aria-label="新建文件夹" onClick={() => openFolderModal(currentMaterialFolder?.id || 0)} />
                        </Tooltip>
                        <Tooltip title="编辑当前文件夹">
                          <Button size="small" icon={<EditOutlined />} aria-label="编辑当前文件夹" disabled={!currentMaterialFolder} onClick={() => currentMaterialFolder && openEditFolderModal(currentMaterialFolder)} />
                        </Tooltip>
                        <Tooltip title="删除当前文件夹">
                          <Button size="small" danger icon={<DeleteOutlined />} aria-label="删除当前文件夹" disabled={!currentMaterialFolder} onClick={deleteCurrentFolder} />
                        </Tooltip>
                      </Space>
                    }
                  >
                    <Space className="oc-folder-list" direction="vertical" size={6} style={{ width: '100%' }}>
                      <Input.Search
                        allowClear
                        size="small"
                        placeholder="搜索文件夹"
                        value={folderKeyword}
                        onChange={event => setFolderKeyword(event.target.value)}
                      />
                      <Button block type={selectedFolderId === 'all' ? 'primary' : 'default'} icon={<FolderOutlined />} onClick={() => setSelectedFolderId('all')}>
                        <span className="oc-folder-button-content">
                          <span className="oc-folder-button-label">全部素材</span>
                          <span className="oc-folder-button-count">{allMaterialCount}</span>
                        </span>
                      </Button>
                      {filteredFolders.length ? (
                        filteredFolders.map(folder => (
                          <Button key={folder.id} block type={selectedFolderId === folder.id ? 'primary' : 'default'} icon={<FolderOutlined />} onClick={() => setSelectedFolderId(folder.id)}>
                            <span className="oc-folder-button-content">
                              <span className="oc-folder-button-label">{folderLabel(folder)}</span>
                              <span className="oc-folder-button-count">{Number(folder.material_count || 0)}</span>
                            </span>
                          </Button>
                        ))
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到文件夹" style={{ margin: '8px 0' }} />
                      )}
                    </Space>
                  </Card>
                </Col>
                <Col className="oc-material-main-col" flex="1 1 0" style={{ minWidth: 0 }}>
                  <Card
                    className="oc-material-main-card"
                    title={
                      <Space className="oc-material-title" size={8} align="center">
                        <span className="oc-material-title-prefix">素材中心</span>
                        <span className="oc-material-current-folder">{currentMaterialFolderName}</span>
                        <span className="oc-material-current-count">共 {currentMaterialCount} 个</span>
                      </Space>
                    }
                    extra={
                      <Space className="oc-material-toolbar" wrap>
                        <Button type="primary" icon={<CloudUploadOutlined />} onClick={openUploadModal}>上传素材</Button>
                        <Radio.Group
                          size="small"
                          value={materialViewMode}
                          onChange={event => setMaterialViewMode(event.target.value)}
                          options={[{ value: 'list', label: '列表' }, { value: 'grid', label: '卡片' }]}
                          optionType="button"
                        />
                        <Input.Search className="oc-material-search" allowClear size="small" placeholder="搜索素材" value={materialKeyword} onChange={event => setMaterialKeyword(event.target.value)} style={{ width: 180 }} />
                        <Select
                          className="oc-material-type-filter"
                          size="small"
                          value={materialType}
                          onChange={setMaterialType}
                          style={{ width: 110 }}
                          options={[
                            { value: 'all', label: '全部类型' },
                            { value: 'video', label: '视频' },
                            { value: 'image', label: '图片' },
                            { value: 'audio', label: '音频' },
                            { value: 'pdf', label: 'PDF' },
                          ]}
                        />
                        {selectedMaterialIds.length > 0 && (
                          <>
                            <Button onClick={() => { setMoveFolderId(null); setMoveModalOpen(true); }}>批量移动</Button>
                            <Tooltip title={`批量删除 ${selectedMaterialIds.length} 个素材`}>
                              <Button danger icon={<DeleteOutlined />} aria-label={`批量删除 ${selectedMaterialIds.length} 个素材`} onClick={() => confirmDelete(`确定删除选中的 ${selectedMaterialIds.length} 个素材吗？已被课程引用的素材不能删除。`, async () => {
                                await onlineCourseApi.batchDeleteMaterials({ ids: selectedMaterialIds });
                                setSelectedMaterialIds([]);
                              })}>批量删除</Button>
                            </Tooltip>
                          </>
                        )}
                      </Space>
                    }
                    styles={{ body: { padding: 0 } }}
                  >
                    <div className="oc-material-storage" style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Text type="secondary">存储容量</Text>
                          <Text type="secondary">
                            已用 {fileSize(storageStats?.used_bytes || storageStats?.material_bytes || 0)}
                          </Text>
                        </Space>
                      </Space>
                    </div>
                    {materialViewMode === 'list' ? (
                      <Table<MaterialRow>
                        rowKey="id"
                        size="middle"
                        dataSource={filteredMaterials}
                        rowSelection={{ selectedRowKeys: selectedMaterialIds, onChange: keys => setSelectedMaterialIds(keys as number[]) }}
                        pagination={{ current: materialPage, pageSize: materialPageSize, total: materialTotalRows, showSizeChanger: false, showTotal: total => `共 ${total} 条` }}
                        onChange={(pagination, _filters, sorter: any) => {
                          setMaterialPage(Number(pagination.current || 1));
                          setMaterialPageSize(Number(pagination.pageSize || 20));
                          if (sorter?.field && sorter?.order) {
                            setMaterialSortBy(String(sorter.field));
                            setMaterialSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
                          } else if (sorter?.field && !sorter?.order) {
                            // 清除排序时恢复到默认排序（上传时间倒序）
                            setMaterialSortBy('created_at');
                            setMaterialSortOrder('desc');
                          }
                        }}
                        scroll={{ x: 1240, y: 820 }}
                        locale={{ emptyText: <Empty description="当前文件夹暂无素材；可点击上传素材" /> }}
                        columns={[
                          {
                            title: sortTitle('素材', 'name'),
                            dataIndex: 'name',
                            fixed: 'left' as const,
                            align: 'left' as const,
                            className: 'material-name-column',
                            onHeaderCell: () => ({ className: 'material-name-column' }),
                            width: 290,
                            sorter: true,
                            sortOrder: materialSortBy === 'name' ? (materialSortOrder === 'asc' ? 'ascend' as const : 'descend' as const) : null,
                            render: (value: string, record: MaterialRow) => (
                              <button
                                type="button"
                                onClick={() => openMaterialPreview(record)}
                                style={{
                                  width: '100%',
                                  padding: 0,
                                  border: 0,
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <Space style={{ width: '100%', justifyContent: 'flex-start' }}>
                                  {materialPreview(record, 38)}
                                  <Text strong>{value}</Text>
                                </Space>
                              </button>
                            ),
                          },
                          { title: sortTitle('类型', 'type'), dataIndex: 'type', width: 90, sorter: true, sortOrder: materialSortBy === 'type' ? (materialSortOrder === 'asc' ? 'ascend' as const : 'descend' as const) : null, render: (value: string) => <Tag color={value === 'video' ? 'purple' : value === 'image' ? 'magenta' : 'blue'}>{materialIcon(value)}</Tag> },
                          { title: sortTitle('文件夹', 'folder_id'), dataIndex: 'folder_id', width: 130, sorter: true, sortOrder: materialSortBy === 'folder_id' ? (materialSortOrder === 'asc' ? 'ascend' as const : 'descend' as const) : null, render: (_: any, record: MaterialRow) => record.folder_name || folders.find(folder => folder.id === record.folder_id)?.name || '-' },
                          { title: sortTitle('大小', 'file_size'), dataIndex: 'file_size', align: 'right' as const, width: 100, sorter: true, sortOrder: materialSortBy === 'file_size' ? (materialSortOrder === 'asc' ? 'ascend' as const : 'descend' as const) : null, render: fileSize },
                          { title: sortTitle('时长', 'duration'), dataIndex: 'duration', align: 'right' as const, width: 100, sorter: true, sortOrder: materialSortBy === 'duration' ? (materialSortOrder === 'asc' ? 'ascend' as const : 'descend' as const) : null, render: durationText },
                          { title: sortTitle('引用', 'is_referenced'), dataIndex: 'is_referenced', width: 90, sorter: true, sortOrder: materialSortBy === 'is_referenced' ? (materialSortOrder === 'asc' ? 'ascend' as const : 'descend' as const) : null, render: (value: number, record: MaterialRow) => value ? <Button type="link" size="small" onClick={() => openMaterialReferences(record)}>是</Button> : <Text type="secondary">否</Text> },
                          { title: sortTitle('上传人', 'uploaded_by'), dataIndex: 'uploaded_by', width: 110, sorter: true, sortOrder: materialSortBy === 'uploaded_by' ? (materialSortOrder === 'asc' ? 'ascend' as const : 'descend' as const) : null, render: (_: any, record: MaterialRow) => record.uploaded_by_name || record.uploaded_by || '-' },
                          { title: sortTitle('上传时间', 'created_at'), dataIndex: 'created_at', width: 150, sorter: true, sortOrder: materialSortBy === 'created_at' ? (materialSortOrder === 'asc' ? 'ascend' as const : 'descend' as const) : null, render: (value: string) => value ? String(value).slice(0, 16) : '-' },
                          {
                            title: '操作',
                            fixed: 'right' as const,
                            width: 120,
                            render: (_: any, record: MaterialRow) => (
                              <Space size={4}>
                                <Button size="small" icon={<EditOutlined />} title="编辑" aria-label="编辑" onClick={() => openMaterialModal(record)} />
                                <Button size="small" danger icon={<DeleteOutlined />} title="删除" aria-label="删除" onClick={() => confirmDelete('确定删除此素材吗？已被课程引用的素材不能删除。', () => onlineCourseApi.deleteMaterial(record.id))} />
                              </Space>
                            ),
                          },
                        ]}
                      />
                    ) : (
                      <div className="oc-material-grid-panel" style={{ padding: 16 }}>
                        {filteredMaterials.length ? (
                          <Row className="oc-material-grid" gutter={[12, 12]}>
                            {filteredMaterials.map(item => (
                              <Col xs={12} sm={8} lg={6} xl={4} key={item.id}>
                                <Card
                                  className="oc-material-grid-card"
                                  size="small"
                                  hoverable
                                  style={{ height: 206, overflow: 'hidden' }}
                                  bodyStyle={{ padding: 8 }}
                                  onDoubleClick={() => openMaterialReferences(item)}
                                >
                                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 6, overflow: 'hidden', background: '#f6f7fb', border: '1px solid #edf0f6' }}>
                                    {materialCover(item)}
                                    <input
                                      type="checkbox"
                                      checked={selectedMaterialIds.includes(item.id)}
                                      onChange={(event) => {
                                        setSelectedMaterialIds(prev => event.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id));
                                      }}
                                      style={{ position: 'absolute', left: 8, top: 8 }}
                                    />
                                  </div>
                                  <Tooltip title={item.name}>
                                    <button
                                      type="button"
                                      onClick={() => openMaterialPreview(item)}
                                      style={{ display: 'block', width: '100%', marginTop: 8, padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
                                    >
                                      <Text strong ellipsis style={{ display: 'block', textAlign: 'center', width: '100%', color: '#1677ff' }}>{item.name}</Text>
                                    </button>
                                  </Tooltip>
                                  <div style={{ textAlign: 'center', marginTop: 4 }}>
                                    {item.is_referenced ? <Button type="link" size="small" onClick={() => openMaterialReferences(item)}>已引用</Button> : <Text type="secondary">未引用</Text>}
                                  </div>
                                  <Space size={4} style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
                                    <Button size="small" type="text" icon={<EyeOutlined />} title="引用" aria-label="引用" onClick={() => openMaterialReferences(item)} />
                                    <Button size="small" type="text" icon={<EditOutlined />} title="编辑" aria-label="编辑" onClick={() => openMaterialModal(item)} />
                                    <Button size="small" type="text" danger icon={<DeleteOutlined />} title="删除" aria-label="删除" onClick={() => confirmDelete('确定删除此素材吗？已被课程引用的素材不能删除。', () => onlineCourseApi.deleteMaterial(item.id))} />
                                  </Space>
                                </Card>
                              </Col>
                            ))}
                          </Row>
                        ) : (
                          <Empty description="当前文件夹暂无素材" />
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                          <Pagination
                            current={materialPage}
                            pageSize={materialPageSize}
                            total={materialTotalRows}
                            showSizeChanger={false}
                            showTotal={total => `共 ${total} 条`}
                            onChange={page => setMaterialPage(page)}
                          />
                        </div>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'series',
            label: <span>{tabMeta.series.icon} 课程管理 {filteredSeries.length}</span>,
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card
                  className="oc-series-list-card"
                  title="课程列表"
                  extra={
                    <Space wrap>
                      <Input.Search allowClear placeholder="搜索课程名称 / 副标题" value={seriesKeyword} onChange={event => setSeriesKeyword(event.target.value)} style={{ width: 240 }} />
                      <Select
                        value={seriesStatus}
                        onChange={setSeriesStatus}
                        style={{ width: 120 }}
                        options={[
                          { value: 'all', label: '全部状态' },
                          { value: 'published', label: '已上架' },
                          { value: 'draft', label: '草稿' },
                          { value: 'offline', label: '已下架' },
                        ]}
                      />
                    </Space>
                  }
                  styles={{ body: { padding: 0 } }}
                >
                  <Table<SeriesRow>
                    className="oc-series-list-table"
                    rowKey="id"
                    size="middle"
                    dataSource={filteredSeries}
                    scroll={{ x: 1380, y: 'calc(100dvh - 320px)' }}
                    pagination={{
                      current: seriesPage,
                      pageSize: seriesPageSize,
                      pageSizeOptions: SERIES_PAGE_SIZE_OPTIONS,
                      showSizeChanger: true,
                      onChange: (page, pageSize) => {
                        setSeriesPage(page);
                        setSeriesPageSize(pageSize);
                      },
                    }}
                    rowClassName={record => record.id === selectedSeriesId ? 'selected-series-row' : ''}
                    onRow={record => ({ onClick: () => setSelectedSeriesId(record.id) })}
                    locale={{ emptyText: <Empty description="暂无线上课程数据" /> }}
                    columns={sortableColumns<SeriesRow>([
                      {
                        title: '课程',
                        dataIndex: 'name',
                        fixed: 'left',
                        align: 'left',
                        className: 'course-name-column series-name-column',
                        onHeaderCell: () => ({ className: 'course-name-column series-name-column' }),
                        width: 330,
                        render: (value, record) => {
                          const coverSource = versionedImageSource(
                            imageDisplaySource(record.cover_image),
                            record.updated_at || record.cover_image || record.id,
                          );
                          return (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openSeriesModal(record);
                              }}
                              style={{
                                width: '100%',
                                padding: 0,
                                border: 0,
                                background: 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                              aria-label={`课程编辑：${value || record.name}`}
                            >
                              <Space style={{ width: '100%', justifyContent: 'flex-start' }}>
                                <div className="series-cover-thumb">
                                  <span>封面</span>
                                  {coverSource ? (
                                    <img
                                      src={coverSource}
                                      alt=""
                                      onError={event => { event.currentTarget.style.display = 'none'; }}
                                    />
                                  ) : null}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <Text strong ellipsis style={{ display: 'block', maxWidth: 230 }}>{value}</Text>
                                  <Text type="secondary" ellipsis style={{ display: 'block', maxWidth: 230 }}>{record.subtitle || '未设置副标题'}</Text>
                                </div>
                              </Space>
                            </button>
                          );
                        },
                      },
                      { title: '分类', dataIndex: 'category', width: 120, render: value => <Tag color="purple">{value || '未分类'}</Tag> },
                      { title: '授课老师', dataIndex: 'teacher', width: 110, render: value => value ? <Tag color="blue">{value}</Tag> : '-' },
                      { title: '课节', width: 80, align: 'right' as const, render: (_, record) => record.course_count ?? record.total_courses ?? 0 },
                      { title: '学员', dataIndex: 'total_students', align: 'right' as const, width: 80, render: value => Number(value || 0) },
                      { title: '价格', dataIndex: 'price', align: 'right' as const, width: 100, render: money },
                      { title: '促销价', dataIndex: 'promo_price', align: 'right' as const, width: 100, render: money },
                      { title: '状态', dataIndex: 'status', width: 100, render: statusTag },
                      {
                        title: '操作',
                        fixed: 'right',
                        width: 280,
                        render: (_, record) => (
                          <Space onClick={event => event.stopPropagation()}>
                            <Button size="small" icon={<EditOutlined />} onClick={() => openSeriesModal(record)} title="课程编辑">编辑</Button>
                            <Button size="small" icon={<PlayCircleOutlined />} href={`/online-course/${record.id}?tab=lessons`} title="进入课程工作台 · 课节编辑">课节</Button>
                            <Button size="small" danger icon={<DeleteOutlined />} title="删除" aria-label="删除" onClick={() => confirmDelete('确定删除此课程及关联课节吗？', () => onlineCourseApi.deleteSeries(record.id))} />
                          </Space>
                        ),
                      },
                    ])}
                  />
                </Card>

              </Space>
            ),
          },
          {
            key: 'auth',
            label: <span>{tabMeta.auth.icon} 学员授权 {totalAuthorizedCount}</span>,
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card
                  className="oc-auth-card"
                  title={currentAuthSeries ? `${currentAuthSeries.name} · 授权管理` : '全部课程 · 授权管理'}
                  extra={
                    <Space className="oc-auth-toolbar" wrap>
                      <Select
                        size="small"
                        value={authSeriesId}
                        onChange={(value) => {
                          setAuthSeriesId(value === 'all' ? 'all' : Number(value));
                          setSelectedAuthIds([]);
                        }}
                        placeholder="选择课程"
                        showSearch
                        optionFilterProp="label"
                        style={{ width: 220 }}
                        options={[
                          { value: 'all', label: '全部课程' },
                          ...series.map(item => ({ value: item.id, label: item.name })),
                        ]}
                      />
                      <Select
                        size="small"
                        value={authFilter}
                        onChange={setAuthFilter}
                        style={{ width: 120 }}
	                        options={[
	                          { value: 'all', label: '全部记录' },
	                          { value: 'authorized', label: '已授权' },
	                          { value: 'unauthorized', label: '仅访问未授权' },
	                        ]}
                      />
                      <Input.Search allowClear size="small" placeholder="搜索姓名 / 手机号" value={authKeyword} onChange={event => setAuthKeyword(event.target.value)} style={{ width: 190 }} />
                      <Button size="small" disabled={!selectedAuthIds.length || authSeriesId === 'all'} onClick={batchAuthorizeSelected}>批量授权</Button>
                      <Button size="small" danger disabled={!selectedAuthIds.length || authSeriesId === 'all'} onClick={batchCancelAuthorization}>批量取消授权</Button>
                      <Button type="primary" size="small" icon={<UserSwitchOutlined />} onClick={() => { authForm.resetFields(); authForm.setFieldsValue({ series_id: authSeriesId === 'all' ? undefined : authSeriesId }); setAuthModalOpen(true); }}>新增授权</Button>
                      <Button type="primary" size="small" ghost icon={<UserSwitchOutlined />} onClick={() => { batchAuthForm.resetFields(); batchAuthForm.setFieldsValue({ series_ids: authSeriesId === 'all' ? [] : [authSeriesId] }); setBatchAuthModalOpen(true); }}>新增批量授权</Button>
                    </Space>
                  }
                  styles={{ body: { padding: 0 } }}
                >
                  <Table<any>
                    rowKey={(record) => String(record.auth_row_key || `${record.series_id || authSeriesId}:${record.id || record.phone}`)}
                    size="middle"
                    dataSource={filteredAuthorizedStudents}
                    rowSelection={{ selectedRowKeys: selectedAuthIds, onChange: keys => setSelectedAuthIds(keys as Array<string | number>) }}
                    scroll={{ x: 860 }}
                    pagination={{ pageSize: 20 }}
                    locale={{ emptyText: <Empty description="暂无授权学员；可用右上角新增授权" /> }}
                    columns={[
                      { title: '学员', dataIndex: 'name', fixed: 'left', width: 130, render: value => <Text strong>{value || '-'}</Text> },
                      {
                        title: '手机号',
                        dataIndex: 'phone',
                        width: 140,
                        render: (value, record) => (
                          <Button
                            type="link"
                            size="small"
                            onClick={() => openAuthMemberModal(record)}
                            style={{ padding: 0, height: 'auto' }}
                          >
                            {value || '-'}
                          </Button>
                        ),
                      },
                      { title: '授权课程', width: 220, render: (_, record) => record.series_name || currentAuthSeries?.name || '-' },
                      { title: '访问来源', width: 150, render: (_, record) => accessSourceText(record) },
                      { title: '授权人', width: 120, render: (_, record) => authActionUser(record) },
                      { title: '授权时间', width: 160, render: (_, record) => authActionTime(record) ? String(authActionTime(record)).slice(0, 16) : '-' },
                      {
                        title: '操作',
                        dataIndex: 'authorized',
                        width: 120,
                        render: (value, record) => {
                          const rowKey = authorizationRowKey(record);
                          return (
                            <Switch
                              checked={Boolean(value)}
                              checkedChildren="已授权"
                              unCheckedChildren="未授权"
                              loading={authToggleLoadingKey === rowKey}
                              disabled={Boolean(authToggleLoadingKey) && authToggleLoadingKey !== rowKey}
                              onChange={checked => toggleAuthorization(record, checked)}
                            />
                          );
                        },
                      },
                    ]}
                  />
                </Card>
                <Card title={`授权订单 ${orderTotalRows}`} styles={{ body: { padding: 0 } }}>
                  <Table<any>
                    rowKey={(record) => String(record.id || record.orderNo || record.order_no)}
                    size="middle"
                    dataSource={orders}
                    scroll={{ x: 1080 }}
                    pagination={{
                      current: orderPage,
                      pageSize: orderPageSize,
                      total: orderTotalRows,
                      showSizeChanger: true,
                      onChange: (page, pageSize) => {
                        setOrderPage(pageSize === orderPageSize ? page : 1);
                        setOrderPageSize(pageSize);
                      },
                    }}
                    locale={{ emptyText: <Empty description="暂无网课授权订单" /> }}
                    columns={[
                      { title: '订单号', width: 160, render: (_, record) => record.order_no || record.orderNo || '-' },
                      { title: '学员', width: 120, render: (_, record) => record.member_name || record.memberName || '-' },
                      { title: '手机号', width: 130, render: (_, record) => record.member_phone || record.memberPhone || '-' },
                      { title: '课程', width: 240, className: 'course-name-column', render: (_, record) => record.series_name || record.title || '-' },
                      { title: '金额', dataIndex: 'amount', align: 'right' as const, width: 120, render: money },
                      { title: '支付方式', width: 100, render: (_, record) => record.pay_method || record.payMethod || '-' },
                      { title: '状态', dataIndex: 'status', width: 100, render: statusTag },
                      { title: '日期', width: 140, render: (_, record) => String(record.paid_at || record.orderDate || record.created_at || '-').slice(0, 16) },
                    ]}
                  />
                </Card>
              </Space>
            ),
          },
        ].sort((a, b) => topTabOrder[a.key] - topTabOrder[b.key]).filter(item => item.key === activeTab)}
      />

      <Modal
        title={previewMaterial ? `预览素材：${previewMaterial.name}` : '预览素材'}
        open={!!previewMaterial}
        onCancel={() => {
          setPreviewMaterial(null);
          setPreviewError('');
        }}
        footer={<Button onClick={() => {
          setPreviewMaterial(null);
          setPreviewError('');
        }}>关闭</Button>}
        width={920}
        destroyOnClose
      >
        {previewMaterial && (() => {
          const source = `/api/course/materials/${previewMaterial.id}/file`;
          if (previewMaterial.type === 'video') {
            return (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {previewError && <Alert type="warning" showIcon message={previewError} />}
                <HlsVideo
                  src={source}
                  useHls={Boolean(previewMaterial.vod_video_id || String(previewMaterial.file_path || '').startsWith('vod:'))}
                  controls
                  autoPlay
                  preload="metadata"
                  onPlaybackError={setPreviewError}
                  style={{ width: '100%', maxHeight: '70vh', borderRadius: 8, background: '#000' }}
                />
              </Space>
            );
          }
          if (previewMaterial.type === 'audio') {
            return <audio src={source} controls autoPlay style={{ width: '100%' }} />;
          }
          if (previewMaterial.type === 'image') {
            return (
              <img
                src={source}
                alt={previewMaterial.name}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', margin: '0 auto', borderRadius: 8, objectFit: 'contain' }}
              />
            );
          }
          if (previewMaterial.type === 'pdf') {
            return <iframe src={source} title={previewMaterial.name} style={{ width: '100%', height: '70vh', border: 0, borderRadius: 8 }} />;
          }
          return (
            <Empty
              description={
                <Space direction="vertical" size={8}>
                  <Text>当前素材类型暂不支持在线预览</Text>
                  <Button href={source} target="_blank">打开文件</Button>
                </Space>
              }
            />
          );
        })()}
      </Modal>

      <Modal
        title={editingSeries ? '课程编辑' : '新建课程'}
        open={seriesModalOpen}
        onCancel={() => setSeriesModalOpen(false)}
        onOk={saveSeries}
        confirmLoading={saving}
        width={600}
        destroyOnClose
        styles={{ body: { paddingTop: 10 } }}
      >
        <Form form={seriesForm} layout="vertical" size="middle">
          <Row gutter={10}>
            <Col xs={12} md={12}><Form.Item name="name" label="课程名称" rules={[{ required: true, message: '请输入课程名称' }]}><Input /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="subtitle" label="副标题"><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="cover_image" hidden><Input /></Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: 12, alignItems: 'start', marginBottom: 10 }}>
            <div>
              {(() => {
                const coverSource = imageDisplaySource(seriesCoverImage);
                return (
                  <Upload
                    showUploadList={false}
                    accept="image/*"
                    beforeUpload={(file) => {
                      uploadSeriesCoverImage(file);
                      return Upload.LIST_IGNORE;
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        width: 180,
                        height: 135,
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: coverSource ? '2px solid #C8A96E' : '2px dashed #E8DDCB',
                        background: coverSource ? '#f6f7fb' : '#FFFDF8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: coverUploading ? 'not-allowed' : 'pointer',
                        position: 'relative',
                        padding: 0,
                      }}
                      disabled={coverUploading}
                      aria-label="上传课程主图"
                    >
                      {coverSource ? (
                        <>
                          <div className="series-cover-preview-fallback">
                            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>封面</div>
                            <div style={{ fontWeight: 600, color: '#8C8172', marginBottom: 4 }}>{coverUploading ? '上传中...' : '课程主图'}</div>
                            <div style={{ fontSize: 12, color: '#B5A898' }}>点击上传</div>
                          </div>
                          <img
                            src={coverSource}
                            alt="课程主图"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={event => { event.currentTarget.style.display = 'none'; }}
                          />
                          <span style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,.56)',
                            color: '#fff',
                            fontSize: 12,
                            lineHeight: '28px',
                            textAlign: 'center',
                          }}>{coverUploading ? '上传中...' : '点击更换'}</span>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>🖼️</div>
                          <div style={{ fontWeight: 600, color: '#8C8172', marginBottom: 4 }}>{coverUploading ? '上传中...' : '课程主图'}</div>
                          <div style={{ fontSize: 12, color: '#B5A898' }}>点击上传</div>
                        </div>
                      )}
                    </button>
                  </Upload>
                );
              })()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 10 }}>
              <Form.Item name="teacher" label="授课老师" style={{ marginBottom: 10 }}><Input /></Form.Item>
              <Form.Item name="status" label="状态" style={{ marginBottom: 10 }}><Select options={[{ value: 'published', label: '已上架' }, { value: 'draft', label: '草稿' }, { value: 'offline', label: '已下架' }]} /></Form.Item>
              <Form.Item name="price" label="原价" style={{ marginBottom: 10 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="promo_price" label="优惠价" style={{ marginBottom: 10 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            </div>
          </div>
          <Row gutter={10}>
            <Col span={24}><Form.Item name="description" label="课程介绍"><Input.TextArea rows={2} /></Form.Item></Col>
            <Col span={24}><Form.Item name="rich_description" label="详情内容"><Input.TextArea rows={3} placeholder="可填写小程序课程详情、图文介绍或 HTML 内容" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={editingLesson ? '编辑课节' : '新建课节'} open={lessonModalOpen} onCancel={() => setLessonModalOpen(false)} onOk={saveLesson} confirmLoading={saving} width={760} destroyOnClose>
        <Form form={lessonForm} layout="vertical">
          <Row gutter={12}>
            <Col xs={12} md={12}><Form.Item name="series_id" label="所属课程" rules={[{ required: true }]}><Select options={series.map(item => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="name" label="课节名称" rules={[{ required: true, message: '请输入课节名称' }]}><Input /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="cover_image" label="课节封面"><Input placeholder="可填写素材图片地址" /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="share_text" label="分享文案"><Input /></Form.Item></Col>
            <Col xs={8} md={8}><Form.Item name="type" label="课节类型"><Select options={[{ value: 'recorded', label: '录播课' }, { value: 'live', label: '直播课' }, { value: 'text', label: '图文课' }]} /></Form.Item></Col>
            <Col xs={8} md={8}><Form.Item name="price" label="价格"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={8} md={8}><Form.Item name="sort_order" label="排序"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="local_status" label="状态"><Select options={[{ value: 'published', label: '已发布' }, { value: 'draft', label: '草稿' }]} /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="is_free_trial" label="试看课节" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={24}><Form.Item name="material_id" label="绑定素材"><Select allowClear showSearch optionFilterProp="label" placeholder="选择视频、音频、图片或 PDF 素材" options={materials.map(item => ({ value: item.id, label: `${item.name} · ${materialIcon(item.type)}` }))} /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="课节说明"><Input.TextArea rows={3} /></Form.Item></Col>
            <Col span={24}><Form.Item name="rich_description" label="课节详情"><Input.TextArea rows={4} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={editingMaterial ? '编辑素材' : '新建素材记录'} open={materialModalOpen} onCancel={() => setMaterialModalOpen(false)} onOk={saveMaterial} confirmLoading={saving} width={760} destroyOnClose>
        <Form form={materialForm} layout="vertical">
          <Row gutter={12}>
            <Col xs={12} md={12}><Form.Item name="name" label="素材名称" rules={[{ required: true, message: '请输入素材名称' }]}><Input /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="type" label="素材类型" rules={[{ required: true }]}><Select options={[{ value: 'video', label: '视频' }, { value: 'image', label: '图片' }, { value: 'audio', label: '音频' }, { value: 'pdf', label: 'PDF' }]} /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="folder_id" label="文件夹"><Select options={folders.map(item => ({ value: item.id, label: folderLabel(item) }))} /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="file_url" label="文件地址"><Input placeholder="/uploads/online-course/..." /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="file_path" label="服务器路径"><Input placeholder="/uploads/course-materials/..." /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="tags" label="标签"><Input placeholder="多个标签用逗号分隔" /></Form.Item></Col>
            <Col xs={8} md={8}><Form.Item name="file_size" label="文件大小(字节)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={8} md={8}><Form.Item name="duration" label="时长(秒)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={8} md={8}><Form.Item name="transcode_status" label="素材状态"><Select options={[{ value: 'completed', label: '已完成' }, { value: 'success', label: '已上传' }, { value: 'processing', label: '云端处理中' }, { value: 'pending', label: '待处理' }, { value: 'failed', label: '失败' }]} /></Form.Item></Col>
            <Col span={24}>
              <Form.Item name="thumbnail" label="缩略图">
                <Input
                  addonAfter={editingMaterial?.type === 'video' ? (
                    <Button type="link" size="small" loading={saving} onClick={regenerateEditingThumbnail}>从首帧生成缩略图</Button>
                  ) : null}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        className="oc-material-upload-modal"
        title={<div className="oc-upload-modal-title"><CloudUploadOutlined /><span>上传素材</span></div>}
        open={uploadModalOpen}
        onCancel={closeUploadModal}
        footer={(
          <Space className="oc-upload-modal-footer">
            {isUploadingMaterials ? (
              <Button danger icon={<StopOutlined />} onClick={stopMaterialUploads}>停止上传</Button>
            ) : (
              <>
                <Button onClick={resetUploadModal}>取消</Button>
                <Button type="primary" onClick={uploadLocalMaterials} loading={saving} disabled={!uploadFiles.length || uploadRunningRef.current}>开始上传</Button>
              </>
            )}
          </Space>
        )}
        width={680}
        destroyOnClose
      >
        <div className="oc-upload-modal-body">
          <div className="oc-upload-target-folder">
            <span className="oc-upload-target-folder-label">{isUploadingMaterials ? '正在上传到' : '目标文件夹'}</span>
            <Text strong className="oc-upload-target-folder-name">
              {uploadTargetFolderName}
            </Text>
          </div>
          {/* 文件选择区：已选文件时隐藏拖拽区，显示文件列表 */}
          {uploadFiles.length === 0 ? (
            <label
              className="ant-upload-wrapper oc-material-upload-dropzone"
              htmlFor="material-local-upload-input"
              onDragOver={event => event.preventDefault()}
              onDrop={event => {
                event.preventDefault();
                const files = Array.from(event.dataTransfer.files || []);
                if (files.length) addUploadFiles(collectUploadFiles(files[0], files));
              }}
            >
              <input
                id="material-local-upload-input"
                type="file"
                multiple
                accept="video/*,audio/*,image/*,.pdf,.doc,.docx,.ppt,.pptx"
                style={{ display: 'none' }}
                onChange={event => {
                  const files = Array.from(event.currentTarget.files || []);
                  if (files.length) addUploadFiles(collectUploadFiles(files[0], files));
                  event.currentTarget.value = '';
                }}
              />
              <div className="ant-upload ant-upload-drag">
                <div className="ant-upload ant-upload-btn">
                  <div className="ant-upload-drag-container">
                    <p className="ant-upload-drag-icon"><CloudUploadOutlined /></p>
                    <p className="ant-upload-text">选择或拖拽素材文件到这里</p>
                    <p className="ant-upload-hint">视频、音频、图片、PDF；单文件最高 {uploadSizeLimitText()}</p>
                  </div>
                </div>
              </div>
            </label>
          ) : (
            <div className="oc-upload-file-panel">
              <div className="oc-upload-file-panel-head">
                <Text strong>已选择 {uploadFiles.length} 个文件</Text>
                <Button size="small" onClick={() => {
                  setUploadFiles([]);
                  setUploadProgress({});
                }}>清空</Button>
              </div>
              <div className="oc-upload-file-list">
                {uploadFiles.map(file => {
                  const progress = uploadProgress[file.uid];
                  const statusText = progress?.status === 'preparing' ? '准备上传'
                    : progress?.status === 'uploading' ? `${progress.percent}%`
                    : progress?.status === 'processing' ? '云端上传'
                    : progress?.status === 'done' ? '完成'
                    : progress?.status === 'error' ? progress.message || '失败'
                    : progress?.status === 'cancelled' ? '已停止'
                    : '';
                  const rowUploading = progress && ['preparing', 'uploading'].includes(progress.status);
                  return (
                    <div key={file.uid} className="oc-upload-file-row">
                      <Text ellipsis className="oc-upload-file-name">{file.name}</Text>
                      {progress && (
                        <Progress
                          className="oc-upload-file-progress"
                          percent={progress.percent}
                          size="small"
                          strokeWidth={3}
                          showInfo={false}
                          status={progress.status === 'error' ? 'exception' : progress.status === 'done' ? 'success' : 'active'}
                        />
                      )}
                      <Tooltip title={progress?.message}>
                        <Text
                          ellipsis
                          className={[
                            'oc-upload-file-status',
                            progress?.status === 'error' ? 'is-error' : '',
                            progress?.status === 'done' ? 'is-done' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          {statusText || fileSize(file.size)}
                        </Text>
                      </Tooltip>
                      <Text type="secondary" className="oc-upload-file-size">{fileSize(file.size)}</Text>
                      <Button type="text" size="small" danger disabled={!!rowUploading} onClick={() => {
                        setUploadFiles(prev => prev.filter(item => item.uid !== file.uid));
                        setUploadProgress(prev => { const n = { ...prev }; delete n[file.uid]; return n; });
                      }} style={{ width: 20, height: 20, minWidth: 20, padding: 0 }}>×</Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal title="批量移动素材" open={moveModalOpen} onCancel={() => setMoveModalOpen(false)} onOk={batchMoveSelectedMaterials} confirmLoading={saving} okButtonProps={{ disabled: !moveFolderId }} destroyOnClose>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">已勾选 <Text strong>{selectedMaterialIds.length}</Text> 个素材，请选择目标文件夹。</Text>
          <Select
            value={moveFolderId}
            onChange={setMoveFolderId}
            placeholder="选择目标文件夹"
            style={{ width: '100%' }}
            options={folders.filter(item => item.id !== selectedFolderId).map(item => ({ value: item.id, label: folderLabel(item) }))}
          />
        </Space>
      </Modal>

      <Modal title="素材引用详情" open={referenceModalOpen} onCancel={() => setReferenceModalOpen(false)} footer={<Button onClick={() => setReferenceModalOpen(false)}>关闭</Button>} width={760} destroyOnClose>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">素材：<Text strong>{referenceMaterial?.name || '-'}</Text></Text>
          <Table
            scroll={{ x: 'max-content' }}
            rowKey={(record) => String(record.id || record.course_id || record.name)}
            size="small"
            dataSource={referenceRows}
            pagination={false}
            locale={{ emptyText: <Empty description="暂无课程引用" /> }}
            columns={[
              { title: '课程/课节', className: 'course-name-column lesson-name-column', render: (_, record) => record.course_name || record.series_name || record.name || '-' },
              { title: '类型', width: 100, render: (_, record) => record.type || record.material_type || '-' },
              { title: '引用时间', width: 160, render: (_, record) => record.created_at ? String(record.created_at).slice(0, 16) : '-' },
              {
                title: '操作',
                width: 100,
                align: 'center',
                render: (_, record) => (
                  <Button size="small" danger loading={saving} onClick={() => cancelMaterialReference(record)}>
                    取消引用
                  </Button>
                ),
              },
            ]}
          />
        </Space>
      </Modal>

      <Modal title={editingFolder ? '编辑文件夹' : '新建文件夹'} open={folderModalOpen} onCancel={() => { setFolderModalOpen(false); setEditingFolder(null); folderForm.resetFields(); }} onOk={() => folderForm.submit()} confirmLoading={saving} destroyOnClose forceRender>
        <Form form={folderForm} layout="vertical" initialValues={{ name: '', parent_id: 0 }} onFinish={saveFolder}>
          <Form.Item
            name="name"
            label="文件夹名称"
            rules={[
              { required: true, message: '请输入文件夹名称' },
              {
                validator: (_, value) => {
                  const error = folderNameError(String(value || ''));
                  if (error) return Promise.reject(new Error(error));
                  const parentId = Number(folderForm.getFieldValue('parent_id') || 0);
                  const duplicated = folders.some(item => Number(item.id) !== Number(editingFolder?.id) && Number(item.parent_id || 0) === parentId && item.name.trim().toLowerCase() === String(value || '').trim().toLowerCase());
                  return duplicated ? Promise.reject(new Error('同一文件夹下已存在同名文件夹')) : Promise.resolve();
                },
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="parent_id" label="父级文件夹"><Select options={[{ value: 0, label: '根目录' }, ...folders.filter(item => {
            if (!editingFolder) return true;
            const blockedIds = folderDescendantIds(folders, Number(editingFolder.id));
            blockedIds.add(Number(editingFolder.id));
            return !blockedIds.has(Number(item.id));
          }).map(item => ({ value: item.id, label: folderLabel(item) }))]} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增学员授权" open={authModalOpen} onCancel={() => setAuthModalOpen(false)} onOk={saveAuthorization} confirmLoading={saving} width={720} destroyOnClose>
        <Form form={authForm} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item name="series_id" label="授权课程" rules={[{ required: true }]}><Select options={series.map(item => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
            <Col xs={24} md={12}>
              <Form.Item name="member_lookup_id" hidden><Input /></Form.Item>
              <Form.Item
                name="member_lookup"
                label="选择学员 / 输入手机号"
                rules={[
                  { required: true, message: '请选择学员，或输入手机号' },
                  {
                    validator: (_, value) => {
                      const subject = resolveAuthSubject(value);
                      return subject.memberId || subject.phone ? Promise.resolve() : Promise.reject(new Error('请选择学员，或输入有效手机号'));
                    },
                  },
                ]}
              >
                <AutoComplete
                  allowClear
                  options={memberAuthOptions}
                  filterOption={(inputValue, option) => String((option as any)?.searchText || (option as any)?.label || '').toLowerCase().includes(inputValue.toLowerCase())}
                  onSelect={(_, option) => authForm.setFieldsValue({ member_lookup_id: (option as any).memberId || '' })}
                  onChange={(value) => {
                    const matched = memberAuthOptions.find(option => option.value === value);
                    authForm.setFieldsValue({ member_lookup_id: matched?.memberId || '' });
                  }}
                  placeholder="搜索姓名/手机号；搜不到可直接输入手机号"
                />
              </Form.Item>
            </Col>
            <Col span={24}><Form.Item name="remark" label="授权备注"><Input.TextArea rows={3} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="新增批量授权"
        open={batchAuthModalOpen}
        onCancel={() => setBatchAuthModalOpen(false)}
        onOk={saveBatchCourseAuthorization}
        confirmLoading={saving}
        width={760}
        destroyOnClose
      >
        <Form form={batchAuthForm} layout="vertical">
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="member_lookup_id" hidden><Input /></Form.Item>
              <Form.Item
                name="member_lookup"
                label="选择学员 / 输入手机号"
                rules={[
                  { required: true, message: '请选择学员，或输入手机号' },
                  {
                    validator: (_, value) => {
                      const subject = resolveAuthSubject(value);
                      return subject.memberId || subject.phone ? Promise.resolve() : Promise.reject(new Error('请选择学员，或输入有效手机号'));
                    },
                  },
                ]}
              >
                <AutoComplete
                  allowClear
                  options={memberAuthOptions}
                  filterOption={(inputValue, option) => String((option as any)?.searchText || (option as any)?.label || '').toLowerCase().includes(inputValue.toLowerCase())}
                  onSelect={(_, option) => batchAuthForm.setFieldsValue({ member_lookup_id: (option as any).memberId || '' })}
                  onChange={(value) => {
                    const matched = memberAuthOptions.find(option => option.value === value);
                    batchAuthForm.setFieldsValue({ member_lookup_id: matched?.memberId || '' });
                  }}
                  placeholder="搜索姓名/手机号；搜不到可直接输入手机号"
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="series_ids" label="批量授权课程" rules={[{ required: true, message: '请选择要授权的课程' }]}>
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="可搜索并选择多个课程"
                  maxTagCount="responsive"
                  options={series.map(item => ({ value: item.id, label: item.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="remark" label="授权备注">
                <Input.TextArea rows={3} placeholder="可填写本次批量授权说明" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="学员档案"
        open={authMemberModalOpen}
        onCancel={() => {
          setAuthMemberModalOpen(false);
          setAuthEditingMember(null);
          authMemberForm.resetFields();
        }}
        onOk={saveAuthMemberProfile}
        confirmLoading={authMemberSaving}
        width={720}
        destroyOnClose
      >
        <Form form={authMemberForm} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                <Input placeholder="学员姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="phone"
                label="手机号"
                rules={[
                  { required: true, message: '请输入手机号' },
                  { pattern: /^\+?[0-9\s()-]{5,24}$/, message: '请输入有效手机号' },
                ]}
              >
                <Input placeholder="可填写国内或国外电话号码" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="gender" label="性别">
                <Select
                  allowClear
                  options={[
                    { value: '女', label: '女' },
                    { value: '男', label: '男' },
                    { value: '未知', label: '未知' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="level" label="等级">
                <Select
                  options={[
                    { value: '普通学员', label: '普通学员' },
                    { value: '体验学员', label: '体验学员' },
                    { value: 'VIP学员', label: 'VIP学员' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="country" label="国家/地区">
                <Input placeholder="中国 / 新加坡 / 美国..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="province" label="省份">
                <Input placeholder="省份" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="city" label="城市">
                <Input placeholder="城市" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="address" label="详细地址">
                <Input placeholder="街道、门牌号等" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={3} placeholder="学员备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="选择课程封面"
        open={coverPickerOpen}
        onCancel={() => setCoverPickerOpen(false)}
        footer={null}
        width={600}
        destroyOnClose
        styles={{ body: { paddingTop: 12 } }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Row gutter={8} align="middle">
            <Col flex="auto">
              <Input.Search allowClear placeholder="搜索图片素材" value={materialKeyword} onChange={event => setMaterialKeyword(event.target.value)} />
            </Col>
            <Col>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  uploadSeriesCoverImage(file);
                  return false;
                }}
              >
                <Button type="primary" icon={<CloudUploadOutlined />} loading={coverUploading}>本地上传</Button>
              </Upload>
            </Col>
          </Row>
          <div style={{ padding: '8px 10px', borderRadius: 6, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 12 }}>
            本地上传会自动保存到素材中心「{String(seriesForm.getFieldValue('name') || editingSeries?.name || '课程主图')}」文件夹，没有则自动新建。
          </div>
          {coverImageMaterials.length ? (
            <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
              <Row gutter={[10, 10]}>
              {coverImageMaterials.map(item => {
                const url = materialSource(item);
                return (
                  <Col span={8} key={item.id}>
                    <Card
                      hoverable
                      size="small"
                      styles={{ body: { padding: 6 } }}
                      onClick={async () => {
                        if (!url) return;
                        setCoverUploading(true);
                        try {
                          await persistSeriesCoverImage(url);
                        } catch (err) {
                          message.error(apiError(err));
                        } finally {
                          setCoverUploading(false);
                        }
                        setCoverPickerOpen(false);
                      }}
                    >
                      <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 6, overflow: 'hidden', background: '#f6f7fb', border: '1px solid #edf0f6' }}>
                        {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : materialCover(item)}
                      </div>
                      <Text ellipsis style={{ display: 'block', marginTop: 6, fontSize: 12 }}>{item.name}</Text>
                    </Card>
                  </Col>
                );
              })}
              </Row>
            </div>
          ) : <Empty description="暂无图片素材" />}
        </Space>
      </Modal>

      <Modal
        title={currentSeries ? `从素材库生成「${currentSeries.name}」课节` : '从素材库生成课节'}
        open={batchLessonModalOpen}
        onCancel={() => setBatchLessonModalOpen(false)}
        onOk={batchCreateLessonsFromMaterials}
        okText="生成课节"
        confirmLoading={saving}
        okButtonProps={{ disabled: !selectedBatchMaterialIds.length }}
        width={980}
        destroyOnClose
      >
        <Row gutter={12}>
          <Col xs={24} md={6}>
            <Card size="small" title="文件夹" styles={{ body: { padding: 8 } }}>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Button block type={batchMaterialFolderId === 'all' ? 'primary' : 'default'} icon={<FolderOutlined />} onClick={() => setBatchMaterialFolderId('all')}>全部素材</Button>
                {folders.map(folder => (
                  <Button key={folder.id} block type={batchMaterialFolderId === folder.id ? 'primary' : 'default'} icon={<FolderOutlined />} onClick={() => setBatchMaterialFolderId(folder.id)}>
                    {folderLabel(folder)}
                  </Button>
                ))}
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={18}>
            <Space wrap style={{ marginBottom: 12 }}>
              <Input.Search allowClear placeholder="搜索素材名称" value={batchMaterialKeyword} onChange={event => setBatchMaterialKeyword(event.target.value)} style={{ width: 240 }} />
              <Select
                value={batchMaterialType}
                onChange={setBatchMaterialType}
                style={{ width: 120 }}
                options={[
                  { value: 'all', label: '全部类型' },
                  { value: 'video', label: '视频' },
                  { value: 'image', label: '图片' },
                  { value: 'audio', label: '音频' },
                  { value: 'pdf', label: 'PDF' },
                ]}
              />
              <Text type="secondary">已选 {selectedBatchMaterialIds.length} 个素材</Text>
            </Space>
            <Table<MaterialRow>
              rowKey="id"
              size="small"
              dataSource={batchSelectableMaterials}
              rowSelection={{ selectedRowKeys: selectedBatchMaterialIds, onChange: keys => setSelectedBatchMaterialIds(keys as number[]) }}
              pagination={{ pageSize: 8 }}
              scroll={{ x: 760 }}
              locale={{ emptyText: <Empty description="暂无可选素材" /> }}
              columns={[
                {
                  title: '素材名',
                  dataIndex: 'name',
                  fixed: 'left',
                  align: 'left' as const,
                  className: 'material-name-column',
                  width: 260,
                  render: (value, record) => (
                    <button
                      type="button"
                      onClick={() => openMaterialPreview(record)}
                      style={{ width: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <Space style={{ width: '100%', justifyContent: 'flex-start' }}>{materialPreview(record, 32)}<Text strong style={{ color: '#1677ff' }}>{value}</Text></Space>
                    </button>
                  ),
                },
                { title: '类型', dataIndex: 'type', width: 90, render: value => <Tag>{materialIcon(value)}</Tag> },
                { title: '大小', dataIndex: 'file_size', width: 100, align: 'right' as const, render: fileSize },
                { title: '时长', dataIndex: 'duration', width: 100, align: 'right' as const, render: durationText },
                { title: '文件夹', dataIndex: 'folder_name', width: 140, render: value => value || '-' },
              ]}
            />
          </Col>
        </Row>
      </Modal>

      <Modal title="授权详情" open={authDetailOpen} onCancel={() => setAuthDetailOpen(false)} footer={<Button onClick={() => setAuthDetailOpen(false)}>关闭</Button>} width={720} destroyOnClose>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="学员">{authDetailRecord?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="手机号">{authDetailRecord?.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="课程">{authDetailRecord?.series_name || currentSeries?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">{authDetailRecord?.authorized ? '已授权' : (authDetailRecord?.authorization_status === 'revoked' ? '已取消' : '未授权')}</Descriptions.Item>
            <Descriptions.Item label="访问来源">{accessSourceText(authDetailRecord)}</Descriptions.Item>
            <Descriptions.Item label="操作人">{authActionUser(authDetailRecord)}</Descriptions.Item>
            <Descriptions.Item label="操作时间">{authActionTime(authDetailRecord) ? String(authActionTime(authDetailRecord)).slice(0, 16) : '-'}</Descriptions.Item>
            <Descriptions.Item label="撤销人">{authDetailRecord?.revoked_by_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="撤销时间">{authDetailRecord?.revoked_at ? String(authDetailRecord.revoked_at).slice(0, 16) : '-'}</Descriptions.Item>
            <Descriptions.Item label="授权次数">{authDetailRecord?.grant_history?.grant_count || 0}</Descriptions.Item>
            <Descriptions.Item label="撤销次数">{authDetailRecord?.grant_history?.revoke_count || 0}</Descriptions.Item>
          </Descriptions>
        </Space>
      </Modal>
    </div>
  );
}
