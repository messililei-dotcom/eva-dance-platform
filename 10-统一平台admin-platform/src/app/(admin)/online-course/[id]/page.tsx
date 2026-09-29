'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Tree,
  Typography,
  Upload,
} from 'antd';
import { Table } from '@/components/adaptive-table';
import { HlsVideo } from '@/components/media/hls-video';
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOutlined,
  PlusOutlined,
  UnorderedListOutlined,
  UserSwitchOutlined,
  VideoCameraOutlined,
  NotificationOutlined,
} from '@ant-design/icons';
import { api, authApi, ensureMediaAuthCookie, onlineCourseApi } from '@/lib/api';
import { platformAdapter } from '@/lib/adapters/platform';
import {
  apiError,
  durationText,
  fileSize,
  imageDisplaySource,
  materialIcon,
  materialPreview,
  materialSource,
  pickArray,
  statusTag,
} from '@/lib/online-course-ui';
import { sortableColumns } from '@/lib/table-sort';
import type { Member } from '@/types/domain';
import type { UploadFile } from 'antd';
import { AuthorizationVoucherUpload } from '@/components/online-course/authorization-voucher-upload';

type MemberRow = Pick<Member, 'id' | 'name' | 'phone' | 'level'>;

const { Text, Title } = Typography;
const MAX_UPLOAD_FILE_SIZE = 1024 * 1024 * 1024;
const BATCH_UPLOAD_CONCURRENCY = 2;
const MATERIAL_PICKER_PAGE_SIZE = 200;
const MATERIAL_PICKER_FETCH_CONCURRENCY = 4;
const MATERIAL_PICKER_TABLE_PAGE_SIZE = 20;

function formatVisitTime(value: unknown) {
  return value ? String(value).replace('T', ' ').slice(0, 16) : '-';
}

function visitRecordText(record: any) {
  const count = Number(record?.visit_count || 0);
  const lastVisitedAt = record?.last_visited_at || record?.first_visited_at || record?.visited_at;
  if (!count && !lastVisitedAt) return '-';
  return `${count || 1}次 · ${formatVisitTime(lastVisitedAt)}`;
}

type BatchUploadStatus = 'ready' | 'preparing' | 'uploading' | 'processing' | 'done' | 'error';

type BatchUploadItem = {
  uid: string;
  name: string;
  percent: number;
  status: BatchUploadStatus;
};

type SeriesDetail = {
  id: number;
  name: string;
  subtitle?: string;
  category?: string;
  teacher?: string;
  price?: number;
  promo_price?: number;
  is_free?: number;
  trial_count?: number;
  status?: string;
  description?: string;
  rich_description?: string;
  cover_image?: string;
  share_image?: string;
  share_text?: string;
  total_courses?: number;
  total_students?: number;
};

type LessonRow = {
  id: number;
  series_id: number;
  name: string;
  description?: string;
  rich_description?: string;
  cover_image?: string;
  course_type?: string;
  type?: string;
  status?: string;
  local_status?: string;
  single_price?: number;
  price?: number;
  duration?: number;
  video_count?: number;
  is_free_trial?: number;
  sort_order?: number;
  share_text?: string;
  videos?: Array<{
    assoc_id?: number;
    id?: number;
    material_id?: number;
    material_name?: string;
    material_original_name?: string;
    material_file_path?: string;
    material_file_url?: string;
    material_vod_video_id?: string;
    name?: string;
    material_type?: string;
    duration?: number;
  }>;
};

type MaterialRow = {
  id: number;
  name: string;
  type?: string;
  folder_id?: number;
  folderId?: number;
  material_folder_id?: number;
  folder_name?: string;
  folderName?: string;
  original_name?: string;
  file_name?: string;
  title?: string;
  folder?: { id?: number | string; name?: string; title?: string };
  file_path?: string;
  file_url?: string;
  thumbnail?: string;
  file_size?: number;
  duration?: number;
  transcode_status?: string;
  vod_video_id?: string;
  created_at?: string;
};

type FolderRow = {
  id: number;
  name: string;
  parent_id: number;
  material_count?: number;
};

function pickFolderRows(payload: unknown): FolderRow[] {
  if (payload && typeof payload === 'object' && Array.isArray((payload as any).flat)) {
    return (payload as any).flat;
  }
  return pickArray<FolderRow>(payload);
}

function fileExtension(value?: string) {
  const clean = String(value || '').split('?')[0].split('#')[0];
  const filename = decodeURIComponent(clean.split('/').pop() || clean);
  const match = filename.match(/\.([A-Za-z0-9]{1,8})$/);
  return match ? `.${match[1]}` : '';
}

function stripFileExtension(value?: string) {
  return String(value || '')
    .replace(/\.(?:mp4|m4v|mov|avi|wmv|flv|mkv|webm|mp3|m4a|wav|aac|flac|ogg|jpg|jpeg|png|gif|webp|svg|pdf|doc|docx|ppt|pptx)$/i, '')
    .trim();
}

function folderLabel(folder?: FolderRow) {
  if (!folder) return '全部素材';
  return folder.parent_id === 0 && folder.name === '默认素材' ? '根目录文件夹' : folder.name;
}

function normalizeMaterialText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function materialFolderId(item: MaterialRow) {
  const raw = item.folder_id ?? item.folderId ?? item.material_folder_id ?? item.folder?.id;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function materialFolderName(item: MaterialRow) {
  return String(item.folder_name ?? item.folderName ?? item.folder?.name ?? item.folder?.title ?? '').trim();
}

function materialRowsFromPayload(payload: unknown): MaterialRow[] {
  const source = payload as any;
  const candidates = [
    source?.data?.items,
    source?.data?.list,
    source?.data?.rows,
    source?.data?.materials,
    source?.data?.data,
    source?.items,
    source?.list,
    source?.rows,
    source?.materials,
    source?.data,
    source,
  ];
  const rows = candidates.find(Array.isArray);
  return rows ? rows : pickArray<MaterialRow>(payload);
}

function materialMetaFromPayload(payload: unknown) {
  const source = payload as any;
  return source?.data?.pagination || source?.data?.meta || source?.pagination || source?.meta || {};
}

function materialNumberFromPayload(payload: unknown, keys: string[], fallback: number) {
  const source = payload as any;
  const meta = materialMetaFromPayload(payload) as any;
  for (const key of keys) {
    const value = source?.[key] ?? source?.data?.[key] ?? meta?.[key];
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue > 0) return numberValue;
  }
  return fallback;
}

function firstMaterial(record: LessonRow) {
  return record.videos?.[0];
}

function lessonMaterialName(record: LessonRow) {
  const material = firstMaterial(record);
  if (!material) return '-';
  const name = material.material_name || material.name || material.material_original_name || '';
  const ext = fileExtension(material.material_original_name) || fileExtension(material.material_file_path) || fileExtension(material.material_file_url);
  return ext && !name.toLowerCase().endsWith(ext.toLowerCase()) ? `${name}${ext}` : name || '-';
}

function lessonMaterialPreviewRecord(record: LessonRow): MaterialRow | null {
  const material = firstMaterial(record);
  const materialId = Number(material?.material_id || 0);
  if (!material || !materialId) return null;
  return {
    id: materialId,
    name: lessonMaterialName(record),
    type: material.material_type,
    file_path: material.material_file_path,
    file_url: material.material_file_url,
    vod_video_id: material.material_vod_video_id,
    duration: material.duration,
  };
}

function displayAdminName(value: unknown) {
  const name = String(value || '').trim();
  return name === '李磊' ? '李雷' : name;
}

function asLocalFile(file: unknown): File | null {
  const candidate = ((file as any)?.originFileObj || file) as File | undefined;
  if (!candidate?.name || typeof candidate.size !== 'number') return null;
  return new File([candidate], candidate.name, {
    type: candidate.type || 'application/octet-stream',
    lastModified: candidate.lastModified || Date.now(),
  });
}

function collectLocalFiles(file: unknown, fileList?: unknown[]) {
  const sources = fileList?.length ? fileList : [file];
  const byKey = new Map<string, File>();
  sources.forEach(item => {
    const localFile = asLocalFile(item);
    if (!localFile || localFile.size <= 0) return;
    const key = `${localFile.name}_${localFile.size}_${localFile.lastModified || 0}`;
    byKey.set(key, localFile);
  });
  return Array.from(byKey.values());
}

function uploadItemKey(file: File) {
  return (file as any).uid || `${file.name}_${file.size}_${file.lastModified || Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function oversizedFileNames(files: File[]) {
  return files.filter(file => file.size > MAX_UPLOAD_FILE_SIZE).map(file => file.name);
}

function lessonSortValue(row: LessonRow) {
  const value = Number(row.sort_order);
  return Number.isInteger(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
}

function normalizeLessonRows(rows: LessonRow[], seriesId?: number) {
  return [...rows]
    .map(item => ({ ...item, ...(seriesId ? { series_id: seriesId } : {}) }))
    .sort((a, b) => lessonSortValue(a) - lessonSortValue(b) || Number(a.id) - Number(b.id))
    .map((item, index) => ({ ...item, sort_order: index + 1 }));
}

function entityFromPayload(payload: any) {
  return payload?.data?.data || payload?.data || payload?.item || payload;
}

function idFromPayload(payload: any) {
  const entity = entityFromPayload(payload);
  const id = Number(entity?.id || payload?.id || 0);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function reorderLessonRows(rows: LessonRow[], lessonId: number, sortOrder: number) {
  const ordered = normalizeLessonRows(rows);
  const currentIndex = ordered.findIndex(item => Number(item.id) === Number(lessonId));
  if (currentIndex < 0) return ordered;

  const nextIndex = Math.max(0, Math.min(ordered.length - 1, Math.trunc(sortOrder) - 1));
  const [moving] = ordered.splice(currentIndex, 1);
  ordered.splice(nextIndex, 0, moving);

  return ordered.map((item, index) => ({ ...item, sort_order: index + 1 }));
}

function durationHoursText(value?: number) {
  const seconds = Math.max(0, Number(value || 0));
  if (!seconds) return '0小时';
  return `${(seconds / 3600).toFixed(1)}小时`;
}

export default function OnlineCourseEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const seriesId = Number(params.id);
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsReady, setMaterialsReady] = useState(false);
  const [membersReady, setMembersReady] = useState(false);
  const [activeTab, setActiveTab] = useState('lessons');
  const [authRows, setAuthRows] = useState<any[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [currentAdminName, setCurrentAdminName] = useState('管理员');
  const [authFilter, setAuthFilter] = useState('all');
  const [authKeyword, setAuthKeyword] = useState('');
  const [authMemberModalOpen, setAuthMemberModalOpen] = useState(false);
  const [authPhoneModalOpen, setAuthPhoneModalOpen] = useState(false);
  const [authMemberSearch, setAuthMemberSearch] = useState('');
  const [authSelectedMemberIds, setAuthSelectedMemberIds] = useState<number[]>([]);
  const [selectedAuthRowKeys, setSelectedAuthRowKeys] = useState<Array<string | number>>([]);
  const [authPhone, setAuthPhone] = useState('');
  const [authMemberVoucherFiles, setAuthMemberVoucherFiles] = useState<UploadFile[]>([]);
  const [authPhoneVoucherFiles, setAuthPhoneVoucherFiles] = useState<UploadFile[]>([]);
  const [singleAuthRecord, setSingleAuthRecord] = useState<any | null>(null);
  const [singleAuthVoucherFiles, setSingleAuthVoucherFiles] = useState<UploadFile[]>([]);
  const [batchSelectedAuthOpen, setBatchSelectedAuthOpen] = useState(false);
  const [batchSelectedVoucherFiles, setBatchSelectedVoucherFiles] = useState<UploadFile[]>([]);
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [lessonMaterialPickerOpen, setLessonMaterialPickerOpen] = useState(false);
  const [batchMaterialPickerOpen, setBatchMaterialPickerOpen] = useState(false);
  const [materialPickerLesson, setMaterialPickerLesson] = useState<LessonRow | null>(null);
  const [previewMaterial, setPreviewMaterial] = useState<MaterialRow | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [coverPickerTarget, setCoverPickerTarget] = useState<'series_cover' | 'series_share'>('series_cover');
  const [coverUploading, setCoverUploading] = useState(false);
  const [lessonMaterialUploading, setLessonMaterialUploading] = useState(false);
  const [batchUploadingLessons, setBatchUploadingLessons] = useState(false);
  const [batchUploadModalOpen, setBatchUploadModalOpen] = useState(false);
  const [batchUploadItems, setBatchUploadItems] = useState<Record<string, BatchUploadItem>>({});
  const [batchUploadFiles, setBatchUploadFiles] = useState<File[]>([]);
  const [editingLesson, setEditingLesson] = useState<LessonRow | null>(null);
  const [selectedLessonIds, setSelectedLessonIds] = useState<number[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  const [lessonPage, setLessonPage] = useState(1);
  const [lessonPageSize, setLessonPageSize] = useState(30);
  const [batchPickerPage, setBatchPickerPage] = useState(1);
  const [lessonSortDrafts, setLessonSortDrafts] = useState<Record<number, number | null>>({});
  const [keyword, setKeyword] = useState('');
  const [materialKeyword, setMaterialKeyword] = useState('');
  const [materialType, setMaterialType] = useState('all');
  const [selectedFolderId, setSelectedFolderId] = useState<number | 'all'>('all');
  const [lessonViewMode, setLessonViewMode] = useState<'list' | 'grid'>('list');
  const [seriesForm] = Form.useForm();
  const [lessonForm] = Form.useForm();
  const batchUploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchUploadFilesRef = useRef<File[]>([]);
  const materialRequestSeq = useRef(0);
  const materialLoadKeyRef = useRef('');
  const coverImage = Form.useWatch('cover_image', seriesForm);

  const lessonStats = useMemo(() => ({
    total: lessons.length,
    duration: lessons.reduce((sum, item) => sum + Number(item.duration || firstMaterial(item)?.duration || 0), 0),
    published: lessons.filter(item => ['published', 'active'].includes(item.local_status || item.status || '')).length,
    students: Number(series?.total_students || 0),
  }), [lessons, series?.total_students]);

  const imageMaterials = useMemo(() => materials.filter(item => item.type === 'image'), [materials]);

  const filteredLessons = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return lessons
      .filter(item => !q || [item.name, item.description, firstMaterial(item)?.material_name].some(value => String(value || '').toLowerCase().includes(q)))
      .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || Number(a.id) - Number(b.id));
  }, [lessons, keyword]);

  const filteredMaterials = useMemo(() => {
    const q = normalizeMaterialText(materialKeyword);
    const selectedFolder =
      selectedFolderId === 'all'
        ? undefined
        : folders.find(folder => Number(folder.id) === Number(selectedFolderId));
    const selectedFolderName = normalizeMaterialText(selectedFolder?.name);
    const selectedFolderNumber = Number(selectedFolderId);
    const isRootFolder =
      selectedFolderName === normalizeMaterialText('根目录文件夹') ||
      (selectedFolder?.parent_id === 0 && selectedFolderName === normalizeMaterialText('默认素材'));

    return materials.filter(item => {
      const itemFolderId = materialFolderId(item);
      const itemFolderName = normalizeMaterialText(materialFolderName(item));
      const matchKeyword =
        !q ||
        [
          item.name,
          item.type,
          item.folder_name,
          item.folderName,
          item.original_name,
          item.file_name,
          item.title,
          materialFolderName(item),
        ].some(value => normalizeMaterialText(value).includes(q));
      const matchType = materialType === 'all' || item.type === materialType;
      const matchFolder =
        selectedFolderId === 'all' ||
        itemFolderId === selectedFolderNumber ||
        (!!selectedFolderName &&
          !!itemFolderName &&
          (itemFolderName === selectedFolderName ||
            itemFolderName.includes(selectedFolderName) ||
            selectedFolderName.includes(itemFolderName))) ||
        (isRootFolder && !itemFolderId && !itemFolderName);
      return matchKeyword && matchType && matchFolder;
    });
  }, [folders, materials, materialKeyword, materialType, selectedFolderId]);

  const filteredImageMaterials = useMemo(() => {
    const q = normalizeMaterialText(materialKeyword);
    return imageMaterials.filter(
      item => !q || [item.name, materialFolderName(item)].some(value => normalizeMaterialText(value).includes(q)),
    );
  }, [imageMaterials, materialKeyword]);

  const referencedMaterialIdList = useMemo(() => {
    const ids = new Set<number>();
    lessons.forEach(lesson => {
      lesson.videos?.forEach(video => {
        const materialId = Number(video.material_id || 0);
        if (materialId > 0) ids.add(materialId);
      });
    });
    return Array.from(ids);
  }, [lessons]);

  const referencedMaterialIds = useMemo(() => new Set(referencedMaterialIdList), [referencedMaterialIdList]);

  const authRowKey = (record: any) => String(record.id || record.member_id || record.phone);
  const selectedAuthRecords = useMemo(() => {
    const selected = new Set(selectedAuthRowKeys.map(String));
    return authRows.filter(record => selected.has(authRowKey(record)));
  }, [authRows, selectedAuthRowKeys]);
  const selectedAuthMemberIds = useMemo(
    () => selectedAuthRecords.map(record => Number(record.id || record.member_id)).filter(Boolean),
    [selectedAuthRecords],
  );

  const loadPickerMaterials = async (input: {
    keyword?: string;
    type?: string;
    folderId?: number | 'all';
    force?: boolean;
  } = {}): Promise<MaterialRow[]> => {
    const keywordValue = input.keyword ?? materialKeyword;
    const typeValue = input.type ?? (coverPickerOpen ? 'image' : materialType);
    const folderValue = input.folderId ?? selectedFolderId;
    const loadKey = [
      normalizeMaterialText(keywordValue),
      typeValue || 'all',
      String(folderValue || 'all'),
    ].join('|');

    if (!input.force && materialsReady && materialLoadKeyRef.current === loadKey) return materials;

    const requestId = materialRequestSeq.current + 1;
    materialRequestSeq.current = requestId;
    setMaterialsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: 1,
        pageSize: MATERIAL_PICKER_PAGE_SIZE,
        sort_by: 'created_at',
        sort_order: 'desc',
        sync: 0,
      };
      if (typeValue && typeValue !== 'all') params.type = typeValue;
      if (normalizeMaterialText(keywordValue)) params.keyword = String(keywordValue).trim();
      if (folderValue !== 'all') params.folder_id = Number(folderValue);

      const [firstMaterialPayload, folderPayload] = await Promise.all([
        onlineCourseApi.getMaterials(params),
        folders.length && !input.force ? Promise.resolve({ flat: folders }) : onlineCourseApi.getMaterialFolders().catch(() => ({ flat: [] })),
      ]);
      const materialRows = materialRowsFromPayload(firstMaterialPayload);
      const materialTotal = materialNumberFromPayload(firstMaterialPayload, ['total', 'total_count', 'count'], materialRows.length);
      const pageCount = Math.ceil(materialTotal / MATERIAL_PICKER_PAGE_SIZE);

      for (let pageStart = 2; pageStart <= pageCount; pageStart += MATERIAL_PICKER_FETCH_CONCURRENCY) {
        if (requestId !== materialRequestSeq.current) return [];
        const pages = Array.from(
          { length: Math.min(MATERIAL_PICKER_FETCH_CONCURRENCY, pageCount - pageStart + 1) },
          (_, index) => pageStart + index,
        );
        const payloads = await Promise.all(
          pages.map(page => onlineCourseApi.getMaterials({ ...params, page })),
        );
        payloads.forEach(payload => materialRows.push(...materialRowsFromPayload(payload)));
      }

      const uniqueMaterialRows = Array.from(new Map(materialRows.map(row => [Number(row.id), row])).values());
      if (requestId !== materialRequestSeq.current) return materialRows;
      setMaterials(uniqueMaterialRows);
      setFolders(pickFolderRows(folderPayload));
      setMaterialsReady(true);
      materialLoadKeyRef.current = loadKey;
      return uniqueMaterialRows;
    } finally {
      if (requestId === materialRequestSeq.current) setMaterialsLoading(false);
    }
  };

  const refreshLessons = async () => {
    const payload = await onlineCourseApi.getSeriesCourses(seriesId).catch(() => ({ data: [] }));
    const rows = normalizeLessonRows(pickArray(payload), seriesId);
    setLessons(rows);
    return rows;
  };

  const ensureMaterialsLoaded = async (force = false) => {
    return loadPickerMaterials({ force });
  };

  const ensureMembersLoaded = async () => {
    if (membersReady) return members;
    const memberRows = await platformAdapter.getMembers().catch(() => []);
    setMembers(memberRows);
    setMembersReady(true);
    return memberRows;
  };

  const loadEditor = async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const [detailPayload, lessonPayload] = await Promise.all([
        onlineCourseApi.getSeriesDetail(seriesId).catch(async () => {
          const all = pickArray(await onlineCourseApi.getSeries());
          return { data: all.find(item => Number(item.id) === seriesId) };
        }),
        onlineCourseApi.getSeriesCourses(seriesId).catch(() => ({ data: [] })),
      ]);
      const detail = detailPayload?.data || detailPayload;
      setSeries(detail);
      seriesForm.setFieldsValue({ ...detail, is_free: Boolean(detail?.is_free) });
      setLessons(normalizeLessonRows(pickArray(lessonPayload), seriesId));
      setMaterials([]);
      setFolders([]);
      setMembers([]);
      setMaterialsReady(false);
      setMembersReady(false);
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    ensureMediaAuthCookie();
    loadEditor();
  }, [seriesId]);

  useEffect(() => {
    const user = authApi.getUser();
    setCurrentAdminName(displayAdminName(user?.name || user?.username || '管理员') || '管理员');
  }, []);

  useEffect(() => {
    setLessonPage(1);
  }, [keyword, lessonViewMode]);

  useEffect(() => {
    if (batchMaterialPickerOpen) setBatchPickerPage(1);
  }, [batchMaterialPickerOpen, materialKeyword, materialType, selectedFolderId]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['lessons', 'batch', 'authorization'].includes(tab)) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    const pickerActive = activeTab === 'batch' || lessonMaterialPickerOpen || batchMaterialPickerOpen || coverPickerOpen;
    if (!seriesId || !pickerActive) return;
    const timer = setTimeout(() => {
      loadPickerMaterials({
        force: true,
        type: coverPickerOpen ? 'image' : materialType,
      }).catch(err => message.error(apiError(err)));
    }, 250);
    return () => clearTimeout(timer);
  }, [
    seriesId,
    activeTab,
    lessonMaterialPickerOpen,
    batchMaterialPickerOpen,
    coverPickerOpen,
    materialKeyword,
    materialType,
    selectedFolderId,
  ]);

  useEffect(() => {
    if (!seriesId || activeTab !== 'authorization') return;
    setAuthLoading(true);
    onlineCourseApi.getSeriesStudents(seriesId, { tab: authFilter, keyword: authKeyword, related_only: 1 })
      .then(payload => {
        setAuthRows(pickArray(payload));
        setSelectedAuthRowKeys([]);
      })
      .catch(err => message.error(apiError(err)))
      .finally(() => setAuthLoading(false));
  }, [seriesId, activeTab, authFilter, authKeyword]);

  const saveSeries = async () => {
    const values = await seriesForm.validateFields();
    setSaving(true);
    try {
      const nextValues = { ...values, is_free: values.is_free ? 1 : 0 };
      await onlineCourseApi.updateSeries(seriesId, nextValues);
      setSeries(prev => prev ? { ...prev, ...nextValues } : prev);
      message.success('课程信息已保存');
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const openLessonModal = (record?: LessonRow) => {
    setEditingLesson(record || null);
    lessonForm.setFieldsValue(record ? {
      name: stripFileExtension(record.name),
      local_status: record.local_status || record.status || 'draft',
      description: record.description || '',
      rich_description: record.rich_description || '',
      sort_order: record.sort_order || 1,
      course_type: record.course_type || record.type || 'recorded',
      is_free_trial: Boolean(record.is_free_trial),
    } : {
      local_status: 'draft',
      description: '',
      rich_description: '',
      sort_order: (lessons.at(-1)?.sort_order || lessons.length) + 1,
      course_type: 'recorded',
      is_free_trial: false,
    });
    setLessonModalOpen(true);
  };

  const replaceLessonMaterial = async (lessonId: number, materialId?: number) => {
    if (!materialId) return;
    const current = pickArray(await onlineCourseApi.getCourseMaterials(lessonId).catch(() => ({ data: [] })));
    await Promise.all(current.map(item => onlineCourseApi.removeCourseMaterial(lessonId, item.assoc_id || item.id)));
    await onlineCourseApi.addCourseMaterial(lessonId, { material_id: materialId });
  };

  const openLessonMaterialPicker = (record: LessonRow) => {
    setMaterialPickerLesson(record);
    setSelectedFolderId('all');
    setMaterialType('all');
    setMaterialKeyword('');
    setLessonMaterialPickerOpen(true);
    loadPickerMaterials({ force: true, keyword: '', type: 'all', folderId: 'all' }).catch(err => message.error(apiError(err)));
  };

  const openMaterialPreview = (record?: MaterialRow | null) => {
    if (!record?.id) {
      message.warning('该课节还没有绑定可预览的素材');
      return;
    }
    ensureMediaAuthCookie();
    setPreviewError('');
    setPreviewMaterial(record);
  };

  const openBatchMaterialPicker = () => {
    setSelectedMaterialIds([]);
    setBatchPickerPage(1);
    setSelectedFolderId('all');
    setMaterialType('all');
    setMaterialKeyword('');
    setBatchMaterialPickerOpen(true);
    loadPickerMaterials({ force: true, keyword: '', type: 'all', folderId: 'all' }).catch(err => message.error(apiError(err)));
  };

  const selectLessonMaterial = async (material: MaterialRow) => {
    if (!materialPickerLesson) return;
    setSaving(true);
    try {
      await replaceLessonMaterial(materialPickerLesson.id, material.id);
      await refreshLessons();
      setLessonMaterialPickerOpen(false);
      setMaterialPickerLesson(null);
      message.success(firstMaterial(materialPickerLesson) ? '素材已替换' : '素材已添加');
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadAndReplaceLessonMaterial = async (file: File) => {
    if (!materialPickerLesson) return;
    setLessonMaterialUploading(true);
    try {
      const folder = await ensureCourseImageFolder();
      const formData = new FormData();
      formData.append('files', file);
      formData.append('folder_id', String(folder.id));
      const result = await onlineCourseApi.uploadLocalMaterials(formData);
      const uploaded = pickArray(result)[0] || result?.data?.[0];
      if (!uploaded?.id) throw new Error('上传成功但未返回素材 ID');
      await replaceLessonMaterial(materialPickerLesson.id, Number(uploaded.id));
      await Promise.all([
        refreshLessons(),
        ensureMaterialsLoaded(true),
      ]);
      setLessonMaterialPickerOpen(false);
      setMaterialPickerLesson(null);
      const vodWarning = Array.isArray(result?.warnings) ? result.warnings[0]?.message : '';
      if (vodWarning) {
        message.warning(`已上传并替换为「${uploaded.name || file.name}」；${vodWarning}`);
      } else {
        message.success(`已上传并替换为「${uploaded.name || file.name}」`);
      }
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setLessonMaterialUploading(false);
    }
  };

  const saveLesson = async () => {
    const values = await lessonForm.validateFields();
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        description: values.description || '',
        rich_description: values.rich_description || '',
        series_id: seriesId,
        status: values.local_status,
        local_status: values.local_status,
        course_type: values.course_type || editingLesson?.course_type || editingLesson?.type || 'recorded',
        type: values.course_type || editingLesson?.course_type || editingLesson?.type || 'recorded',
        single_price: editingLesson ? Number(editingLesson.single_price ?? editingLesson.price ?? 0) : 0,
        price: editingLesson ? Number(editingLesson.single_price ?? editingLesson.price ?? 0) : 0,
        sort_order: Number(values.sort_order || editingLesson?.sort_order || (lessons.at(-1)?.sort_order || lessons.length) + 1),
        is_free_trial: values.is_free_trial ? 1 : 0,
      };
      if (editingLesson) {
        await onlineCourseApi.updateCourse(editingLesson.id, payload);
        setLessons(prev => normalizeLessonRows(
          prev.map(item => Number(item.id) === Number(editingLesson.id)
            ? { ...item, ...payload, id: editingLesson.id, videos: item.videos }
            : item),
          seriesId,
        ));
      } else {
        const result = await onlineCourseApi.createCourse(payload);
        const createdId = idFromPayload(result);
        if (createdId) {
          setLessons(prev => normalizeLessonRows([
            ...prev,
            {
              ...payload,
              id: createdId,
              series_id: seriesId,
              duration: 0,
              video_count: 0,
              videos: [],
            } as LessonRow,
          ], seriesId));
        } else {
          await refreshLessons();
        }
      }
      message.success(editingLesson ? '课节已更新' : '课节已新建');
      setLessonModalOpen(false);
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const batchUpdateLessons = async (nextStatus: string) => {
    if (!selectedLessonIds.length) return;
    setSaving(true);
    try {
      await onlineCourseApi.batchUpdateCourseStatus({ ids: selectedLessonIds, status: nextStatus });
      message.success(nextStatus === 'published' ? '已批量上架' : '已批量下架');
      const targetIds = new Set(selectedLessonIds.map(Number));
      setLessons(prev => prev.map(item => targetIds.has(Number(item.id)) ? { ...item, status: nextStatus, local_status: nextStatus } : item));
      setSelectedLessonIds([]);
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteLessons = (ids: number[]) => {
    if (!ids.length) return;
    modal.confirm({
      title: `确定删除 ${ids.length} 个课节吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await onlineCourseApi.batchDeleteCourses({ ids });
          message.success('已删除');
          const deletedIds = new Set(ids.map(Number));
          setLessons(prev => normalizeLessonRows(prev.filter(item => !deletedIds.has(Number(item.id))), seriesId));
          setSelectedLessonIds(prev => prev.filter(id => !deletedIds.has(Number(id))));
        } catch (err) {
          message.error(apiError(err));
          throw err;
        }
      },
    });
  };

  const batchCreateLessons = async () => {
    if (!selectedMaterialIds.length) {
      message.warning('请选择素材');
      return;
    }
    setSaving(true);
    try {
      const result = await onlineCourseApi.batchCreateCourses({ series_id: seriesId, material_ids: selectedMaterialIds });
      const createdCount = Number(result?.count || pickArray(result).length || 0);
      message.success(`已生成 ${createdCount || selectedMaterialIds.length} 个课节`);
      setSelectedMaterialIds([]);
      setBatchMaterialPickerOpen(false);
      setActiveTab('lessons');
      await refreshLessons();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const batchUploadLocalLessons = async (files: File[]) => {
    if (batchUploadingLessons) {
      message.warning('正在上传课节，请稍候');
      return;
    }
    const validFiles = files.filter(file => file.size > 0);
    if (!validFiles.length) {
      message.warning('请选择要上传的素材文件');
      return;
    }
    const tooLarge = oversizedFileNames(validFiles);
    if (tooLarge.length) {
      message.error(`单文件不得超过1GB：${tooLarge.slice(0, 3).join('、')}${tooLarge.length > 3 ? ' 等' : ''}`);
      return;
    }
    // 打开进度弹窗
    const initProgress: Record<string, BatchUploadItem> = {};
    const uidMap = new Map<File, string>();
    validFiles.forEach(file => {
      const fid = uploadItemKey(file);
      uidMap.set(file, fid);
      initProgress[fid] = { uid: fid, name: file.name, percent: 0, status: 'ready' };
    });
    setBatchUploadItems(initProgress);
    setBatchUploadModalOpen(true);
    setBatchUploadingLessons(true);

    const uploadedMaterials: any[] = [];
    const errors: string[] = [];
    const vodWarnings: string[] = [];

    try {
      const folder = await ensureCourseImageFolder();
      let cursor = 0;
      const workerCount = Math.min(BATCH_UPLOAD_CONCURRENCY, validFiles.length);
      const uploadOne = async (file: File) => {
        const uid = uidMap.get(file) || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setBatchUploadItems(prev => ({ ...prev, [uid]: { ...prev[uid], status: 'preparing', percent: 2 } }));
        try {
          const formData = new FormData();
          formData.append('files', file);
          formData.append('folder_id', String(folder.id));

          setBatchUploadItems(prev => ({ ...prev, [uid]: { ...prev[uid], status: 'uploading', percent: 5 } }));
          const result = await onlineCourseApi.uploadLocalMaterials(formData, {
            onUploadProgress: (event: any) => {
              const total = event.total || file.size || 1;
              if (event.loaded >= total) {
                setBatchUploadItems(prev => ({ ...prev, [uid]: { ...prev[uid], status: 'processing', percent: Math.max(prev[uid]?.percent || 0, 95) } }));
                return;
              }
              const percent = Math.min(90, Math.round((event.loaded / total) * 90));
              setBatchUploadItems(prev => ({ ...prev, [uid]: { ...prev[uid], status: 'uploading', percent } }));
            },
          });
          const uploaded = pickArray(result)[0] || result?.data?.[0];
          if (uploaded?.id) {
            uploadedMaterials.push(uploaded);
            if (Array.isArray(result?.warnings) && result.warnings[0]?.message) {
              vodWarnings.push(result.warnings[0].message);
            }
            setBatchUploadItems(prev => ({ ...prev, [uid]: { ...prev[uid], status: 'done', percent: 100 } }));
          } else {
            throw new Error('上传成功但未返回素材 ID');
          }
        } catch (err) {
          setBatchUploadItems(prev => ({ ...prev, [uid]: { ...prev[uid], status: 'error', percent: 0 } }));
          errors.push(`${file.name}: ${apiError(err)}`);
        }
      };

      const workers = Array.from({ length: workerCount }, async () => {
        while (cursor < validFiles.length) {
          const index = cursor;
          cursor += 1;
          await uploadOne(validFiles[index]);
        }
      });
      await Promise.all(workers);

      // 批量生成课节
      const materialIds = uploadedMaterials.map(item => Number(item.id)).filter(Boolean);
      let createdCount = 0;
      if (materialIds.length) {
        const result = await onlineCourseApi.batchCreateCourses({ series_id: seriesId, material_ids: materialIds });
        createdCount = Number(result?.count || pickArray(result).length || 0);
      }

      if (errors.length) {
        message.warning(`完成：上传成功 ${uploadedMaterials.length} 个，生成课节 ${createdCount} 个，失败 ${errors.length} 个`);
      } else if (vodWarnings.length) {
        message.warning(`上传完成：共上传 ${uploadedMaterials.length} 个素材并生成 ${createdCount} 个课节；${vodWarnings[0]}`);
      } else {
        message.success(`上传完成！共上传 ${uploadedMaterials.length} 个素材并生成 ${createdCount} 个课节`);
      }
      await refreshLessons();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setBatchUploadingLessons(false);
    }
  };

  const prepareBatchUploadLocalLessons = (files: File[]) => {
    if (batchUploadingLessons) {
      message.warning('正在上传课节，请稍候');
      return;
    }
    const validFiles = files.filter(file => file.size > 0);
    if (!validFiles.length) {
      message.warning('请选择要上传的素材文件');
      return;
    }
    const tooLarge = oversizedFileNames(validFiles);
    if (tooLarge.length) {
      message.error(`单文件不得超过1GB：${tooLarge.slice(0, 3).join('、')}${tooLarge.length > 3 ? ' 等' : ''}`);
    }
    const allowedFiles = validFiles.filter(file => file.size <= MAX_UPLOAD_FILE_SIZE);
    if (!allowedFiles.length) return;
    const initProgress: Record<string, BatchUploadItem> = {};
    allowedFiles.forEach(file => {
      const fid = uploadItemKey(file);
      (file as any).uid = fid;
      initProgress[fid] = { uid: fid, name: file.name, percent: 0, status: 'ready' };
    });
    setBatchUploadFiles(allowedFiles);
    setBatchUploadItems(initProgress);
    setBatchUploadModalOpen(true);
  };

  const scheduleBatchUploadLocalLessons = (files: File[]) => {
    const validFiles = files.filter(file => file.size > 0);
    if (!validFiles.length) return;
    batchUploadFilesRef.current = validFiles;
    if (batchUploadTimerRef.current) clearTimeout(batchUploadTimerRef.current);
    batchUploadTimerRef.current = setTimeout(() => {
      const nextFiles = batchUploadFilesRef.current;
      batchUploadFilesRef.current = [];
      batchUploadTimerRef.current = null;
      if (nextFiles.length) prepareBatchUploadLocalLessons(nextFiles);
    }, 0);
  };

  const closeBatchUploadModal = () => {
    setBatchUploadModalOpen(false);
    setBatchUploadFiles([]);
    setBatchUploadItems({});
  };

  const confirmBatchUploadLocalLessons = () => {
    if (!batchUploadFiles.length) {
      message.warning('请选择要上传的素材文件');
      return;
    }
    batchUploadLocalLessons(batchUploadFiles);
  };

  const saveLessonSort = async (record: LessonRow, sortOrder: number | null) => {
    const nextSortOrder = Math.trunc(Number(sortOrder));
    if (!Number.isInteger(nextSortOrder) || nextSortOrder < 1 || nextSortOrder === Number(record.sort_order)) return;

    const previousLessons = lessons;
    const nextLessons = reorderLessonRows(lessons, record.id, nextSortOrder);
    const changed = nextLessons.some((item, index) => Number(item.id) !== Number(previousLessons[index]?.id) || Number(item.sort_order) !== Number(previousLessons[index]?.sort_order));
    if (!changed) return;

    setLessons(nextLessons);
    try {
      await onlineCourseApi.reorderSeriesCourses(seriesId, { ids: nextLessons.map(item => item.id) });
      const payload = await onlineCourseApi.getSeriesCourses(seriesId).catch(() => ({ data: nextLessons }));
      setLessons(normalizeLessonRows(pickArray(payload), seriesId));
    } catch (err) {
      setLessons(previousLessons);
      message.error(apiError(err));
    }
  };

  const lessonSortInputValue = (record: LessonRow) => (
    Object.prototype.hasOwnProperty.call(lessonSortDrafts, record.id)
      ? lessonSortDrafts[record.id]
      : record.sort_order || 1
  );

  const setLessonSortDraft = (record: LessonRow, value: number | null) => {
    setLessonSortDrafts(prev => ({ ...prev, [record.id]: value }));
  };

  const commitLessonSort = async (record: LessonRow) => {
    const draft = lessonSortInputValue(record);
    setLessonSortDrafts(prev => {
      const next = { ...prev };
      delete next[record.id];
      return next;
    });
    await saveLessonSort(record, draft);
  };

  const updateSeriesStatus = async (nextStatus: string) => {
    setSaving(true);
    try {
      const values = seriesForm.getFieldsValue();
      await onlineCourseApi.updateSeries(seriesId, { ...series, ...values, status: nextStatus, is_free: values.is_free ? 1 : 0 });
      setSeries(prev => prev ? { ...prev, status: nextStatus } : prev);
      message.success(nextStatus === 'published' ? '课程已上架' : '课程已下架');
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const publishContentUpdate = () => {
    let summary = '';
    modal.confirm({
      title: '发布课程更新',
      content: (
        <Input.TextArea
          rows={4}
          placeholder={`向已授权学员说明本次更新内容，例如：新增 ${lessonStats.published} 节课程内容`}
          onChange={event => { summary = event.target.value; }}
        />
      ),
      okText: '发布并通知学员',
      cancelText: '取消',
      onOk: async () => {
        const response = await api.post(`/course/series/${seriesId}/release`, { summary });
        const recipients = Number(response.data?.data?.recipients || 0);
        message.success(`课程更新已发布，已通知 ${recipients} 名学员`);
      },
    });
  };

  const deleteSeries = () => {
    modal.confirm({
      title: '确定删除此课程吗？',
      content: '删除后课程信息和关联课节将不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await onlineCourseApi.deleteSeries(seriesId);
          message.success('课程已删除');
          router.push('/online-course?tab=series');
        } catch (err) {
          message.error(apiError(err));
          throw err;
        }
      },
    });
  };

  const openCoverPicker = (target: 'series_cover' | 'series_share') => {
    setCoverPickerTarget(target);
    setSelectedFolderId('all');
    setMaterialKeyword('');
    setCoverPickerOpen(true);
    loadPickerMaterials({ force: true, keyword: '', type: 'image', folderId: 'all' }).catch(err => message.error(apiError(err)));
  };

  const persistPickedImage = async (source: string, silent = false) => {
    applyCoverImage(source);
    if (coverPickerTarget === 'series_cover' || coverPickerTarget === 'series_share') {
      const field = coverPickerTarget === 'series_cover' ? 'cover_image' : 'share_image';
      const values = seriesForm.getFieldsValue(true);
      const nextValues = { ...series, ...values, [field]: source };
      await onlineCourseApi.updateSeries(seriesId, { ...nextValues, is_free: nextValues.is_free ? 1 : 0 });
      setSeries(prev => prev ? { ...prev, [field]: source } : prev);
      if (!silent) message.success(coverPickerTarget === 'series_cover' ? '课程主图已自动保存' : '分享图已自动保存');
      return;
    }
  };

  const selectImageMaterial = async (record: MaterialRow) => {
    const source = materialSource(record);
    if (!source) {
      message.warning('该图片素材没有可用地址');
      return;
    }
    setCoverUploading(true);
    try {
      await persistPickedImage(source);
      setCoverPickerOpen(false);
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setCoverUploading(false);
    }
  };

  const applyCoverImage = (source: string) => {
    if (coverPickerTarget === 'series_cover') seriesForm.setFieldValue('cover_image', source);
    if (coverPickerTarget === 'series_share') seriesForm.setFieldValue('share_image', source);
  };

  const ensureCourseImageFolder = async () => {
    const folderName = series?.name?.trim() || `课程-${seriesId}`;
    const currentFolders = folders.length
      ? folders
      : pickFolderRows(await onlineCourseApi.getMaterialFolders().catch(() => ({ flat: [] })));
    const existing = currentFolders.find(folder => Number(folder.parent_id || 0) === 0 && folder.name === folderName);
    if (existing) return existing;
    try {
      const result = await onlineCourseApi.createMaterialFolder({ name: folderName, parent_id: 0 });
      return result?.data || result;
    } catch {
      const folderPayload = await onlineCourseApi.getMaterialFolders().catch(() => ({ flat: [] }));
      const refreshed = pickFolderRows(folderPayload);
      const fallback = refreshed.find((folder: FolderRow) => Number(folder.parent_id || 0) === 0 && folder.name === folderName);
      if (fallback) return fallback;
      throw new Error('课程图片文件夹创建失败');
    }
  };

  const uploadCoverImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.warning('请选择图片文件');
      return;
    }
    setCoverUploading(true);
    try {
      const folder = await ensureCourseImageFolder();
      const formData = new FormData();
      formData.append('files', file);
      formData.append('folder_id', String(folder.id));
      const result = await onlineCourseApi.uploadLocalMaterials(formData);
      const uploaded = pickArray(result)[0] || result?.data?.[0];
      const source = uploaded?.file_url || uploaded?.file_path || uploaded?.thumbnail;
      if (!source) throw new Error('上传成功，但没有返回图片地址');
      setCoverPickerOpen(false);
      await ensureMaterialsLoaded(true);
      await persistPickedImage(source, true);
      message.success(`图片已上传到「${folder.name}」并自动保存`);
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setCoverUploading(false);
    }
  };

  const cancelAuthorization = (record: any) => {
    modal.confirm({
      title: '确定取消此学员授权吗？',
      okText: '取消授权',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await onlineCourseApi.deauthorizeMember(seriesId, { member_id: record.id || record.member_id, phone: record.phone });
          message.success('已取消授权');
          const studentPayload = await onlineCourseApi.getSeriesStudents(seriesId, { tab: authFilter, keyword: authKeyword, related_only: 1 }).catch(() => ({ data: [] }));
          setAuthRows(pickArray(studentPayload));
        } catch (err) {
          message.error(apiError(err));
          throw err;
        }
      },
    });
  };

  const uploadAuthorizationVouchers = async (files: UploadFile[], subject: string) => {
    if (!files.length) throw new Error('请上传订单凭证');
    const group = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const vouchers = [];
    for (const [index, uploadFile] of files.entries()) {
      if (!uploadFile.originFileObj) throw new Error('订单凭证文件已失效，请重新选择');
      const formData = new FormData();
      formData.append('file', uploadFile.originFileObj);
      formData.append('subject', subject || '未命名学员');
      formData.append('course', series?.name || `课程${seriesId}`);
      formData.append('group', group);
      formData.append('sequence', String(index + 1));
      const response = await api.post('/course/authorization-vouchers', formData);
      const payload = response.data;
      const voucher = payload?.data || payload;
      if (!voucher?.voucherPath) throw new Error('订单凭证上传失败');
      vouchers.push(voucher);
    }
    return vouchers;
  };

  const authorizeSingleMember = (record: any) => {
    setSingleAuthRecord(record);
    setSingleAuthVoucherFiles([]);
  };

  const confirmAuthorizeSingleMember = async () => {
    if (!singleAuthRecord) return;
    if (!singleAuthVoucherFiles.length) return void message.warning('请上传订单凭证');
    setSaving(true);
    try {
      const vouchers = await uploadAuthorizationVouchers(singleAuthVoucherFiles, singleAuthRecord.name || singleAuthRecord.phone || `学员${singleAuthRecord.id}`);
      await onlineCourseApi.authorizeMember(seriesId, { member_id: singleAuthRecord.id || singleAuthRecord.member_id, type: 'admin_grant', order_vouchers: vouchers });
      message.success('已授权');
      setSingleAuthRecord(null);
      setSingleAuthVoucherFiles([]);
      reloadAuthRecords();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const batchAuthorizeSelected = () => {
    if (!selectedAuthMemberIds.length) {
      message.warning('请选择学员');
      return;
    }
    setBatchSelectedVoucherFiles([]);
    setBatchSelectedAuthOpen(true);
  };

  const confirmBatchAuthorizeSelected = async () => {
    if (!batchSelectedVoucherFiles.length) return void message.warning('请上传订单凭证');
    setSaving(true);
    try {
      const vouchers = await uploadAuthorizationVouchers(batchSelectedVoucherFiles, `批量学员${selectedAuthMemberIds.length}人`);
      await onlineCourseApi.batchAuthorizeMembers(seriesId, { member_ids: selectedAuthMemberIds, order_vouchers: vouchers });
      message.success(`已授权 ${selectedAuthMemberIds.length} 位学员`);
      setSelectedAuthRowKeys([]);
      setBatchSelectedAuthOpen(false);
      setBatchSelectedVoucherFiles([]);
      reloadAuthRecords();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const batchCancelAuthorization = () => {
    if (!selectedAuthMemberIds.length) {
      message.warning('请选择学员');
      return;
    }
    modal.confirm({
      title: `确定取消 ${selectedAuthMemberIds.length} 位学员授权吗？`,
      okText: '取消授权',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await onlineCourseApi.batchDeauthorizeMembers(seriesId, { member_ids: selectedAuthMemberIds });
          message.success(`已取消 ${selectedAuthMemberIds.length} 位学员授权`);
          setSelectedAuthRowKeys([]);
          reloadAuthRecords();
        } catch (err) {
          message.error(apiError(err));
          throw err;
        }
      },
    });
  };

  const openAuthMemberModal = () => {
    setAuthMemberSearch('');
    setAuthSelectedMemberIds([]);
    setAuthMemberVoucherFiles([]);
    setAuthMemberModalOpen(true);
    ensureMembersLoaded().catch(err => message.error(apiError(err)));
  };

  const openAuthPhoneModal = () => {
    setAuthPhone('');
    setAuthPhoneVoucherFiles([]);
    setAuthPhoneModalOpen(true);
  };

  const reloadAuthRecords = () => {
    if (!seriesId) return;
    setAuthLoading(true);
    onlineCourseApi.getSeriesStudents(seriesId, { tab: authFilter, keyword: authKeyword, related_only: 1 })
      .then(payload => {
        setAuthRows(pickArray(payload));
        setSelectedAuthRowKeys([]);
      })
      .catch(err => message.error(apiError(err)))
      .finally(() => setAuthLoading(false));
  };

  const doAuthMember = async () => {
    if (!authSelectedMemberIds.length) {
      message.warning('请选择学员');
      return;
    }
    if (!authMemberVoucherFiles.length) return void message.warning('请上传订单凭证');
    setSaving(true);
    try {
      const vouchers = await uploadAuthorizationVouchers(authMemberVoucherFiles, `批量学员${authSelectedMemberIds.length}人`);
      await onlineCourseApi.batchAuthorizeMembers(seriesId, { member_ids: authSelectedMemberIds, order_vouchers: vouchers });
      message.success(`已授权 ${authSelectedMemberIds.length} 位学员`);
      setAuthMemberModalOpen(false);
      reloadAuthRecords();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const doAuthPhone = async () => {
    const phone = authPhone.trim();
    if (!phone || !/^1\d{10}$/.test(phone)) {
      message.warning('请输入正确的手机号');
      return;
    }
    if (!authPhoneVoucherFiles.length) return void message.warning('请上传订单凭证');
    setSaving(true);
    try {
      const vouchers = await uploadAuthorizationVouchers(authPhoneVoucherFiles, phone);
      await onlineCourseApi.authorizePhone(seriesId, { phone, order_vouchers: vouchers });
      message.success(`已预授权手机号 ${phone}`);
      setAuthPhoneModalOpen(false);
      reloadAuthRecords();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  if (!series) {
    return (
      <Card>
        <Empty description="没有找到课程" />
        <Button style={{ marginTop: 16 }} onClick={() => router.push('/online-course?tab=series')}>返回课程列表</Button>
      </Card>
    );
  }

  const folderTreeData = [
    { key: 'all', title: `全部素材 (${materials.length})`, icon: <FolderOutlined /> },
    ...folders.map(folder => ({
      key: String(folder.id),
      title: `${folderLabel(folder)}${folder.material_count ? ` (${folder.material_count})` : ''}`,
      icon: <FolderOutlined />,
    })),
  ];

  const navItems = [
    { key: 'lessons', label: '课节编辑', icon: <VideoCameraOutlined /> },
    { key: 'authorization', label: '学员授权', icon: <UserSwitchOutlined /> },
  ];
  const sortInputStyle = (value?: number | null) => ({
    width: Math.min(74, Math.max(44, String(value || 1).length * 10 + 30)),
  });

  return (
    <div className="oc-course-detail-page">
      <div className="page-header">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space direction="vertical" size={6}>
              <Button type="link" icon={<ArrowLeftOutlined />} style={{ padding: 0 }} onClick={() => router.push('/online-course?tab=series')}>返回课程列表</Button>
              <Space wrap align="center" size={8}>
                {statusTag(series.status)}
                <Title level={2} style={{ margin: 0, lineHeight: 1.15 }}>{series.name}</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>{series.subtitle || '管理课程信息、课节内容和课程授权'}</Text>
              </Space>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Button type="primary" icon={<NotificationOutlined />} onClick={publishContentUpdate}>发布更新通知</Button>
              <Button onClick={() => updateSeriesStatus(series.status === 'published' ? 'offline' : 'published')}>{series.status === 'published' ? '下架' : '上架'}</Button>
              <Tooltip title="删除课程">
                <Button danger icon={<DeleteOutlined />} aria-label="删除课程" onClick={deleteSeries} />
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </div>

      <Card className="oc-course-workbench-switchbar" styles={{ body: { padding: 8 } }} style={{ marginBottom: 16 }}>
        <div className="oc-course-workbench-switchbar-inner">
          <Space wrap size={8}>
            {navItems.map(item => (
              <Button key={item.key} type={activeTab === item.key ? 'primary' : 'text'} icon={item.icon} onClick={() => setActiveTab(item.key)}>
                {item.label}
              </Button>
            ))}
          </Space>
          {activeTab === 'lessons' && (
            <div className="oc-lesson-inline-stats" aria-label="课节统计">
              <span className="oc-lesson-stat-pill"><span>总课节</span><strong>{lessonStats.total}</strong><span>节</span></span>
              <span className="oc-lesson-stat-pill"><span>总时长</span><strong>{durationHoursText(lessonStats.duration)}</strong></span>
              <span className="oc-lesson-stat-pill"><span>已上架</span><strong>{lessonStats.published}</strong><span>节</span></span>
              <span className="oc-lesson-stat-pill"><span>学员数</span><strong>{lessonStats.students}</strong><span>人</span></span>
            </div>
          )}
        </div>
      </Card>

      <Row gutter={[16, 16]} align="top">
        <Col span={24}>
          {activeTab === 'lessons' && (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Card
                className="oc-lesson-editor-card"
                title="课节编辑"
                extra={
                  <Space wrap>
                    <Input.Search allowClear placeholder="搜索课节或素材" value={keyword} onChange={event => setKeyword(event.target.value)} style={{ width: 220 }} />
                    <Radio.Group size="small" value={lessonViewMode} onChange={event => setLessonViewMode(event.target.value)} optionType="button">
                      <Radio.Button value="list"><UnorderedListOutlined /></Radio.Button>
                      <Radio.Button value="grid"><AppstoreOutlined /></Radio.Button>
                    </Radio.Group>
                    <Button icon={<PlusOutlined />} onClick={() => openLessonModal()}>新建课节</Button>
                    <Button icon={<FolderOutlined />} onClick={openBatchMaterialPicker}>从素材库添加</Button>
                    <Upload
                      multiple
                      showUploadList={false}
                      accept="video/*,audio/*,image/*,.pdf,.doc,.docx,.ppt,.pptx"
                      beforeUpload={(file, fileList) => {
                        scheduleBatchUploadLocalLessons(collectLocalFiles(file, fileList));
                        return false;
                      }}
                    >
                      <Button icon={<CloudUploadOutlined />} loading={batchUploadingLessons}>批量本地上传</Button>
                    </Upload>
                    <Button disabled={!selectedLessonIds.length} onClick={() => batchUpdateLessons('published')}>批量上架</Button>
                    <Button disabled={!selectedLessonIds.length} onClick={() => batchUpdateLessons('offline')}>批量下架</Button>
                    <Tooltip title={`批量删除 ${selectedLessonIds.length} 个课节`}>
                      <Button danger icon={<DeleteOutlined />} aria-label={`批量删除 ${selectedLessonIds.length} 个课节`} disabled={!selectedLessonIds.length} onClick={() => deleteLessons(selectedLessonIds)}>批量删除</Button>
                    </Tooltip>
                  </Space>
                }
                styles={{ body: { padding: lessonViewMode === 'list' ? 0 : 16 } }}
              >
                {lessonViewMode === 'list' ? (
                  <Table<LessonRow>
                    rowKey="id"
                    size="middle"
                    className="oc-lesson-table"
                    dataSource={filteredLessons}
                    rowSelection={{ selectedRowKeys: selectedLessonIds, onChange: keys => setSelectedLessonIds(keys as number[]) }}
                    pagination={{
                      current: lessonPage,
                      pageSize: lessonPageSize,
                      showSizeChanger: true,
                      pageSizeOptions: [20, 30, 50, 100],
                      showTotal: total => `共 ${total} 条`,
                      onChange: (page, pageSize) => {
                        setLessonPage(page);
                        setLessonPageSize(pageSize);
                      },
                    }}
                    scroll={{ x: 1240, y: 'calc(100dvh - 390px)' }}
                    locale={{ emptyText: <Empty description="暂无课节；可新建或批量创建" /> }}
                    columns={sortableColumns<LessonRow>([
                      {
                        title: '排序',
                        dataIndex: 'sort_order',
                        align: 'center' as const,
                        width: isMobile ? 64 : 76,
                        render: (value, record) => {
                          const inputValue = lessonSortInputValue(record);
                          return (
                            <InputNumber
                              className="oc-lesson-sort-input"
                              min={1}
                              size="small"
                              controls={false}
                              value={inputValue}
                              onChange={next => setLessonSortDraft(record, next)}
                              onBlur={() => commitLessonSort(record)}
                              onKeyDown={event => {
                                if (event.key === 'Enter') event.currentTarget.blur();
                              }}
                              style={sortInputStyle(inputValue ?? value)}
                            />
                          );
                        },
                      },
                      { title: '课节名称', dataIndex: 'name', fixed: 'left', align: 'left' as const, width: 260, className: 'lesson-name-column', render: value => <Text strong style={{ display: 'block', textAlign: 'left' }}>{stripFileExtension(value) || value}</Text> },
                      {
                        title: '对应素材',
                        width: 280,
                        render: (_, record) => {
                          const material = firstMaterial(record);
                          const previewRecord = lessonMaterialPreviewRecord(record);
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                              <button
                                type="button"
                                disabled={!previewRecord}
                                onClick={() => openMaterialPreview(previewRecord)}
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  padding: 0,
                                  border: 0,
                                  background: 'transparent',
                                  cursor: previewRecord ? 'pointer' : 'default',
                                  textAlign: 'left',
                                }}
                              >
                                <Text style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35, color: previewRecord ? '#1677ff' : undefined }}>
                                  {lessonMaterialName(record)}
                                </Text>
                              </button>
                              <Button size="small" onClick={() => openLessonMaterialPicker(record)}>{material ? '替换' : '添加'}</Button>
                            </div>
                          );
                        },
                      },
                      { title: '时长', dataIndex: 'duration', align: 'right' as const, width: 100, render: durationText },
                      { title: '状态', width: 100, render: (_, record) => statusTag(record.local_status || record.status) },
                      { title: '操作', fixed: 'right', width: 120, render: (_, record) => <Space size={4}><Button size="small" icon={<EditOutlined />} title="编辑" aria-label="编辑" onClick={() => openLessonModal(record)} /><Button size="small" danger icon={<DeleteOutlined />} title="删除" aria-label="删除" onClick={() => deleteLessons([record.id])} /></Space> },
                    ])}
                  />
                ) : filteredLessons.length ? (
                  <Row gutter={[12, 12]}>
                    {filteredLessons.map(item => {
                      const previewRecord = lessonMaterialPreviewRecord(item);
                      return (
                        <Col xs={24} md={12} xl={8} key={item.id}>
                          <Card size="small" hoverable onClick={() => openLessonModal(item)} style={{ height: '100%' }}>
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                                <InputNumber
                                  min={1}
                                  size="small"
                                  controls={false}
                                  value={lessonSortInputValue(item)}
                                  onClick={event => event.stopPropagation()}
                                  onChange={next => setLessonSortDraft(item, next)}
                                  onBlur={() => commitLessonSort(item)}
                                  onKeyDown={event => {
                                    event.stopPropagation();
                                    if (event.key === 'Enter') event.currentTarget.blur();
                                  }}
                                  style={sortInputStyle(lessonSortInputValue(item) ?? item.sort_order)}
                                />
                                <Text strong ellipsis style={{ maxWidth: 180 }}>{stripFileExtension(item.name) || item.name}</Text>
                                {statusTag(item.local_status || item.status)}
                              </Space>
                              {previewRecord ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openMaterialPreview(previewRecord);
                                  }}
                                  style={{ padding: 0, border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', maxWidth: '100%' }}
                                >
                                  <Text type="secondary" ellipsis style={{ color: '#1677ff', maxWidth: '100%' }}>{lessonMaterialName(item)}</Text>
                                </button>
                              ) : (
                                <Text type="secondary" ellipsis>{item.description || '未绑定素材'}</Text>
                              )}
                              <Space wrap><Tag>{item.course_type || item.type || 'recorded'}</Tag><Tag>{durationText(item.duration || firstMaterial(item)?.duration)}</Tag>{item.is_free_trial ? <Tag color="green">试看</Tag> : <Tag>付费</Tag>}</Space>
                            </Space>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                ) : <Empty description="暂无课节" />}
              </Card>
            </Space>
          )}

          {activeTab === 'batch' && (
            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}>
                <Card title="素材文件夹" styles={{ body: { padding: 8 } }}>
                  <Tree showIcon selectedKeys={[String(selectedFolderId)]} treeData={folderTreeData} onSelect={keys => setSelectedFolderId(keys[0] === 'all' || !keys[0] ? 'all' : Number(keys[0]))} />
                </Card>
              </Col>
              <Col xs={24} md={18}>
                <Card
                  title="从素材库生成课节"
                  extra={<Space wrap><Input.Search allowClear placeholder="搜索素材名称" value={materialKeyword} onChange={event => setMaterialKeyword(event.target.value)} style={{ width: 220 }} /><Select value={materialType} onChange={setMaterialType} style={{ width: 120 }} options={[{ value: 'all', label: '全部类型' }, { value: 'video', label: '视频' }, { value: 'image', label: '图片' }, { value: 'audio', label: '音频' }, { value: 'pdf', label: 'PDF' }]} /><Button type="primary" icon={<PlusOutlined />} disabled={!selectedMaterialIds.length} loading={saving} onClick={batchCreateLessons}>生成课节</Button></Space>}
                  styles={{ body: { padding: 0 } }}
                >
                  <Table<MaterialRow>
                    rowKey="id"
                    size="middle"
                    loading={materialsLoading}
                    dataSource={filteredMaterials}
                    rowSelection={{ selectedRowKeys: selectedMaterialIds, onChange: keys => setSelectedMaterialIds(keys as number[]) }}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    scroll={{ x: 920, y: 'calc(100dvh - 430px)' }}
                    locale={{ emptyText: <Empty description="暂无可选素材" /> }}
                    columns={[
                      {
                        title: '素材名称',
                        dataIndex: 'name',
                        fixed: 'left',
                        align: 'left' as const,
                        className: 'material-name-column',
                        width: 300,
                        render: (value, record) => (
                          <button
                            type="button"
                            onClick={() => openMaterialPreview(record)}
                            style={{ width: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <Space style={{ width: '100%', justifyContent: 'flex-start' }}>{materialPreview(record, 34)}<Text strong style={{ color: '#1677ff' }}>{value}</Text></Space>
                          </button>
                        ),
                      },
                      { title: '类型', dataIndex: 'type', width: 100, render: value => <Tag>{materialIcon(value)}</Tag> },
                      { title: '文件夹', dataIndex: 'folder_name', width: 160, render: value => value || '-' },
                      { title: '大小', dataIndex: 'file_size', width: 110, align: 'right' as const, render: fileSize },
                      { title: '时长', dataIndex: 'duration', width: 110, align: 'right' as const, render: durationText },
                    ]}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {activeTab === 'authorization' && (
            <Card
              title={<Space><span>学员授权</span><Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>共 {authRows.length} 条</Text></Space>}
              extra={
                <Space wrap>
                  <Input.Search allowClear placeholder="搜索姓名/手机号/member_id/openid/unionid" value={authKeyword} onChange={event => setAuthKeyword(event.target.value)} style={{ width: 320 }} />
                  <Select value={authFilter} onChange={setAuthFilter} style={{ width: 110 }} options={[{ value: 'all', label: '全部' }, { value: 'authorized', label: '已授权' }, { value: 'unauthorized', label: '仅浏览' }]} />
                  <Button onClick={batchAuthorizeSelected} disabled={!selectedAuthRowKeys.length} loading={saving}>批量授权</Button>
                  <Button danger onClick={batchCancelAuthorization} disabled={!selectedAuthRowKeys.length}>批量取消授权</Button>
                  <Button icon={<UserSwitchOutlined />} onClick={openAuthMemberModal}>学员授权</Button>
                  <Button size="small" onClick={reloadAuthRecords}>刷新</Button>
                </Space>
              }
              styles={{ body: { padding: 0 } }}
            >
              <Table<any>
                rowKey={authRowKey}
                size="middle"
                loading={authLoading}
                dataSource={authRows}
                rowSelection={{ selectedRowKeys: selectedAuthRowKeys, onChange: keys => setSelectedAuthRowKeys(keys as Array<string | number>) }}
                pagination={{ pageSize: 20, showTotal: total => `共 ${total} 条` }}
                scroll={{ x: 1520, y: 'calc(100dvh - 390px)' }}
                locale={{ emptyText: <Empty description="暂无本课程授权或浏览记录" /> }}
                columns={sortableColumns<any>([
                  { title: '学员', dataIndex: 'name', fixed: 'left', width: 140, sorter: true, render: value => <Text strong>{value || '学员'}</Text> },
                  { title: 'member_id', dataIndex: 'member_id', width: 100, sorter: true, render: (_, record) => record.member_id || record.id || '-' },
                  { title: '手机号', dataIndex: 'phone', width: 140, sorter: true, render: value => value || '-' },
                  { title: '微信 UnionID', dataIndex: 'wx_unionid', width: 220, sorter: true, render: value => value || '-' },
                  { title: '访问记录', dataIndex: 'visit_count', width: 180, sorter: true, render: (_, record) => visitRecordText(record) },
                  {
                    title: '来源',
                    dataIndex: 'visit_source',
                    width: 110,
                    sorter: true,
                    render: value => value === 'auth_request' ? '授权申请' : value === 'catalog' ? '浏览课节' : value === 'video' ? '观看记录' : value || '-',
                  },
                  { title: '授权人', dataIndex: 'granted_by_name', width: 120, sorter: true, render: value => displayAdminName(value) || currentAdminName },
                  { title: '授权时间', dataIndex: 'granted_at', width: 160, sorter: true, render: value => value ? String(value).replace('T', ' ').slice(0, 16) : '-' },
                  {
                    title: '操作',
                    fixed: 'right',
                    width: 120,
                    render: (_, record) => record.authorized
                      ? <Button size="small" danger onClick={() => cancelAuthorization(record)}>取消授权</Button>
                      : <Button size="small" type="primary" onClick={() => authorizeSingleMember(record)}>授权</Button>,
                  },
                ])}
              />
            </Card>
          )}
        </Col>
      </Row>

      <Modal title={editingLesson ? '编辑课节' : '新建课节'} open={lessonModalOpen} onCancel={() => setLessonModalOpen(false)} onOk={saveLesson} confirmLoading={saving} width={760} destroyOnClose>
        <Form form={lessonForm} layout="vertical">
          <Row gutter={12}>
            <Col xs={12} md={12}><Form.Item name="name" label="课节名称" rules={[{ required: true, message: '请输入课节名称' }]}><Input /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="sort_order" label="排序"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="local_status" label="状态"><Select options={[{ value: 'published', label: '已上架' }, { value: 'draft', label: '草稿' }, { value: 'offline', label: '已下架' }]} /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="course_type" label="课节类型"><Select options={[{ value: 'recorded', label: '录播课' }, { value: 'live', label: '直播课' }, { value: 'text', label: '图文课' }]} /></Form.Item></Col>
            <Col xs={12} md={12}><Form.Item name="is_free_trial" label="免费试看" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="课节说明"><Input.TextArea rows={3} /></Form.Item></Col>
            <Col span={24}><Form.Item name="rich_description" label="课节详情"><Input.TextArea rows={5} placeholder="课节详情、图文介绍或 HTML 内容" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={materialPickerLesson ? `${firstMaterial(materialPickerLesson) ? '替换' : '添加'}素材：${materialPickerLesson.name}` : '选择素材'}
        open={lessonMaterialPickerOpen}
        onCancel={() => {
          setLessonMaterialPickerOpen(false);
          setMaterialPickerLesson(null);
        }}
        footer={null}
        width={980}
        destroyOnClose
      >
        <Row gutter={[12, 12]}>
          <Col xs={24} md={6}>
            <Card size="small" title="素材文件夹" styles={{ body: { padding: 8 } }}>
              <Tree
                showIcon
                selectedKeys={[String(selectedFolderId)]}
                treeData={folderTreeData}
                onSelect={keys => setSelectedFolderId(keys[0] === 'all' || !keys[0] ? 'all' : Number(keys[0]))}
              />
            </Card>
          </Col>
          <Col xs={24} md={18}>
            <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
              <Space wrap>
              <Input.Search allowClear placeholder="搜索素材名称" value={materialKeyword} onChange={event => setMaterialKeyword(event.target.value)} style={{ width: 240 }} />
              <Select
                value={materialType}
                onChange={setMaterialType}
                style={{ width: 120 }}
                options={[
                  { value: 'all', label: '全部类型' },
                  { value: 'video', label: '视频' },
                  { value: 'image', label: '图片' },
                  { value: 'audio', label: '音频' },
                  { value: 'pdf', label: 'PDF' },
                ]}
              />
              </Space>
              <Upload
                showUploadList={false}
                accept="video/*,audio/*,image/*,.pdf,.doc,.docx,.ppt,.pptx"
                beforeUpload={(file) => {
                  uploadAndReplaceLessonMaterial(file);
                  return false;
                }}
              >
                <Button type="primary" icon={<CloudUploadOutlined />} loading={lessonMaterialUploading}>本地上传并替换</Button>
              </Upload>
            </Space>
            <Table<MaterialRow>
              rowKey="id"
              size="small"
              loading={materialsLoading}
              dataSource={filteredMaterials}
              pagination={{ pageSize: 8 }}
              scroll={{ x: 760 }}
              locale={{ emptyText: <Empty description="暂无可选素材" /> }}
              columns={[
                {
                  title: '素材名称',
                  dataIndex: 'name',
                  fixed: 'left',
                  align: 'left' as const,
                  className: 'material-name-column',
                  width: 300,
                  render: (value, record) => (
                    <button
                      type="button"
                      onClick={() => openMaterialPreview(record)}
                      style={{ width: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <Space style={{ width: '100%', justifyContent: 'flex-start' }}>{materialPreview(record, 34)}<Text strong style={{ color: '#1677ff' }}>{value}</Text></Space>
                    </button>
                  ),
                },
                { title: '类型', dataIndex: 'type', width: 90, render: value => <Tag>{materialIcon(value)}</Tag> },
                { title: '文件夹', dataIndex: 'folder_name', width: 140, render: value => value || '-' },
                { title: '大小', dataIndex: 'file_size', width: 100, align: 'right' as const, render: fileSize },
                { title: '时长', dataIndex: 'duration', width: 100, align: 'right' as const, render: durationText },
                { title: '操作', fixed: 'right', width: 90, render: (_, record) => <Button type="primary" size="small" loading={saving} onClick={() => selectLessonMaterial(record)}>选择</Button> },
              ]}
            />
          </Col>
        </Row>
      </Modal>

      <Modal
        title="从素材中心选择素材生成课节"
        open={batchMaterialPickerOpen}
        onCancel={() => setBatchMaterialPickerOpen(false)}
        onOk={batchCreateLessons}
        okText="生成课节"
        confirmLoading={saving}
        okButtonProps={{ disabled: !selectedMaterialIds.length }}
        width={1580}
        className="batch-material-picker-modal"
        destroyOnClose
      >
        <Row gutter={[12, 12]} className="batch-material-picker-layout">
          <Col xs={24} md={7} className="batch-material-picker-folder-col">
            <Card size="small" title="素材文件夹" className="batch-material-picker-folder-card" styles={{ body: { padding: 8 } }}>
              <Tree
                showIcon
                selectedKeys={[String(selectedFolderId)]}
                treeData={folderTreeData}
                onSelect={keys => setSelectedFolderId(keys[0] === 'all' || !keys[0] ? 'all' : Number(keys[0]))}
              />
            </Card>
          </Col>
          <Col xs={24} md={17} className="batch-material-picker-material-col">
            <Space className="batch-material-picker-toolbar" wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
              <Space wrap>
                <Input.Search allowClear placeholder="搜索素材名称" value={materialKeyword} onChange={event => setMaterialKeyword(event.target.value)} style={{ width: 240 }} />
                <Select
                  value={materialType}
                  onChange={setMaterialType}
                  style={{ width: 120 }}
                  options={[
                    { value: 'all', label: '全部类型' },
                    { value: 'video', label: '视频' },
                    { value: 'image', label: '图片' },
                    { value: 'audio', label: '音频' },
                    { value: 'pdf', label: 'PDF' },
                  ]}
                />
              </Space>
              <Text type="secondary">
                已选 {selectedMaterialIds.length} 个素材
                {referencedMaterialIdList.length ? ` · 本课程已引用 ${referencedMaterialIdList.length} 个` : ''}
              </Text>
            </Space>
            <Table<MaterialRow>
              className="batch-material-picker-table"
              rowKey="id"
              size="small"
              loading={materialsLoading}
              dataSource={filteredMaterials}
              rowSelection={{
                selectedRowKeys: selectedMaterialIds,
                onChange: keys => setSelectedMaterialIds((keys as Array<string | number>).map(Number).filter(id => !referencedMaterialIds.has(id))),
                getCheckboxProps: record => ({
                  disabled: referencedMaterialIds.has(Number(record.id)),
                  title: referencedMaterialIds.has(Number(record.id)) ? '本课程已引用，不能重复生成课节' : undefined,
                }),
              }}
              pagination={{
                current: batchPickerPage,
                pageSize: MATERIAL_PICKER_TABLE_PAGE_SIZE,
                showSizeChanger: false,
                onChange: page => setBatchPickerPage(page),
              }}
              scroll={{ x: 760, y: 900 }}
              locale={{ emptyText: <Empty description="暂无可选素材" /> }}
              columns={[
                {
                  title: '素材名称',
                  dataIndex: 'name',
                  fixed: 'left',
                  align: 'left' as const,
                  className: 'material-name-column',
                  width: 300,
                  render: (value, record) => (
                    <button
                      type="button"
                      onClick={() => openMaterialPreview(record)}
                      style={{ width: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <Space style={{ width: '100%', justifyContent: 'flex-start' }}>{materialPreview(record, 34)}<Text strong style={{ color: '#1677ff' }}>{value}</Text>{referencedMaterialIds.has(Number(record.id)) ? <Tag color="green">已引用</Tag> : null}</Space>
                    </button>
                  ),
                },
                { title: '类型', dataIndex: 'type', width: 90, render: value => <Tag>{materialIcon(value)}</Tag> },
                { title: '文件夹', dataIndex: 'folder_name', width: 140, render: value => value || '-' },
                { title: '大小', dataIndex: 'file_size', width: 100, align: 'right' as const, render: fileSize },
                { title: '时长', dataIndex: 'duration', width: 100, align: 'right' as const, render: durationText },
              ]}
            />
          </Col>
        </Row>
      </Modal>

      <Modal title="选择图片素材" open={coverPickerOpen} onCancel={() => setCoverPickerOpen(false)} footer={null} width={900} destroyOnClose>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Input.Search allowClear placeholder="搜索图片素材" value={materialKeyword} onChange={event => setMaterialKeyword(event.target.value)} style={{ width: 360 }} />
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                uploadCoverImage(file);
                return false;
              }}
            >
              <Button type="primary" icon={<CloudUploadOutlined />} loading={coverUploading}>本地上传图片</Button>
            </Upload>
          </Space>
          <Text type="secondary">上传后自动保存到「{series?.name || `课程-${seriesId}`}」文件夹，并填入当前图片字段。</Text>
          <Table<MaterialRow>
            scroll={{ x: 'max-content' }}
            rowKey="id"
            size="middle"
            loading={materialsLoading}
            dataSource={filteredImageMaterials}
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="暂无图片素材" /> }}
            columns={[
              { title: '图片', dataIndex: 'name', render: (value, record) => <Space>{materialPreview(record, 54)}<Text strong>{value}</Text></Space> },
              { title: '文件夹', dataIndex: 'folder_name', width: 160, render: value => value || '-' },
              { title: '大小', dataIndex: 'file_size', width: 110, align: 'right' as const, render: fileSize },
              { title: '操作', width: 100, render: (_, record) => <Button type="primary" size="small" onClick={() => selectImageMaterial(record)}>选择</Button> },
            ]}
          />
        </Space>
      </Modal>

      {/* 学员授权弹窗 */}
      <Modal title="选择学员授权" open={authMemberModalOpen} onCancel={() => { setAuthMemberModalOpen(false); setAuthMemberVoucherFiles([]); }} onOk={doAuthMember} confirmLoading={saving} width={560} destroyOnClose>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            placeholder="搜索学员姓名 / 手机号"
            value={authMemberSearch}
            onChange={event => setAuthMemberSearch(event.target.value)}
            style={{ width: '100%' }}
          />
          <Table
            rowKey="id"
            size="small"
            dataSource={members.filter(m => {
              if (!authMemberSearch.trim()) return false;
              const q = authMemberSearch.trim().toLowerCase();
              return [m.name, m.phone].some(v => String(v || '').toLowerCase().includes(q));
            })}
            rowSelection={{
              selectedRowKeys: authSelectedMemberIds,
              onChange: keys => setAuthSelectedMemberIds(keys as number[]),
            }}
            pagination={{ pageSize: 8 }}
            scroll={{ y: 280 }}
            locale={{ emptyText: <Empty description={authMemberSearch.trim() ? '未找到匹配学员' : '请输入关键字搜索学员'} /> }}
            columns={[
              { title: '姓名', dataIndex: 'name', width: 120 },
              { title: '手机号', dataIndex: 'phone', width: 140 },
              { title: '等级', dataIndex: 'level', width: 100, render: value => <Tag>{value || '-'}</Tag> },
            ]}
          />
          <Text type="secondary">已选 {authSelectedMemberIds.length} 位学员</Text>
          <div>
            <Text strong>订单凭证（必填）</Text>
            <Text type="secondary" style={{ display: 'block', margin: '4px 0 10px' }}>所选学员统一使用同一套凭证，支持多张。</Text>
            <AuthorizationVoucherUpload fileList={authMemberVoucherFiles} onChange={setAuthMemberVoucherFiles} disabled={saving} />
          </div>
        </Space>
      </Modal>

      {/* 电话预授权弹窗 */}
      <Modal title="手机号预授权" open={authPhoneModalOpen} onCancel={() => { setAuthPhoneModalOpen(false); setAuthPhoneVoucherFiles([]); }} onOk={doAuthPhone} confirmLoading={saving} width={520} destroyOnClose>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Text strong>课程：</Text>
            <Text>{series?.name || '-'}</Text>
          </div>
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>手机号</Text>
            <Input
              placeholder="输入学员手机号"
              value={authPhone}
              onChange={event => setAuthPhone(event.target.value)}
              maxLength={11}
              style={{ width: '100%' }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>输入手机号后，该学员将获得本课程的完整访问权限。</Text>
          </div>
          <div>
            <Text strong>订单凭证（必填）</Text>
            <Text type="secondary" style={{ display: 'block', margin: '4px 0 10px' }}>支持多张图片，单张不超过 12MB。</Text>
            <AuthorizationVoucherUpload fileList={authPhoneVoucherFiles} onChange={setAuthPhoneVoucherFiles} disabled={saving} />
          </div>
        </Space>
      </Modal>

      <Modal
        title="确认授权并上传订单凭证"
        open={Boolean(singleAuthRecord)}
        onCancel={() => { setSingleAuthRecord(null); setSingleAuthVoucherFiles([]); }}
        onOk={confirmAuthorizeSingleMember}
        confirmLoading={saving}
        okText="确认授权"
        destroyOnClose
      >
        <Alert type="info" showIcon message={`${singleAuthRecord?.name || singleAuthRecord?.phone || '该学员'} 将获得「${series?.name || '当前课程'}」访问权限`} style={{ marginBottom: 16 }} />
        <Text strong>订单凭证（必填）</Text>
        <Text type="secondary" style={{ display: 'block', margin: '4px 0 10px' }}>支持多张图片，单张不超过 12MB。</Text>
        <AuthorizationVoucherUpload fileList={singleAuthVoucherFiles} onChange={setSingleAuthVoucherFiles} disabled={saving} />
      </Modal>

      <Modal
        title={`批量授权 ${selectedAuthMemberIds.length} 位学员`}
        open={batchSelectedAuthOpen}
        onCancel={() => { setBatchSelectedAuthOpen(false); setBatchSelectedVoucherFiles([]); }}
        onOk={confirmBatchAuthorizeSelected}
        confirmLoading={saving}
        okText="确认批量授权"
        destroyOnClose
      >
        <Alert type="info" showIcon message="本次批量授权将统一使用下面同一套订单凭证。" style={{ marginBottom: 16 }} />
        <Text strong>订单凭证（必填）</Text>
        <Text type="secondary" style={{ display: 'block', margin: '4px 0 10px' }}>支持多张图片，单张不超过 12MB。</Text>
        <AuthorizationVoucherUpload fileList={batchSelectedVoucherFiles} onChange={setBatchSelectedVoucherFiles} disabled={saving} />
      </Modal>

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

      {/* 批量本地上传进度弹窗 */}
      <Modal
        title={batchUploadingLessons ? '本地上传进度' : '确认批量本地上传'}
        open={batchUploadModalOpen}
        onCancel={batchUploadingLessons ? undefined : closeBatchUploadModal}
        footer={batchUploadingLessons ? null : (
          Object.values(batchUploadItems).some(item => item.status !== 'ready') ? (
            <Button onClick={closeBatchUploadModal}>关闭</Button>
          ) : (
            <Space>
              <Button onClick={closeBatchUploadModal}>取消</Button>
              <Button type="primary" icon={<CloudUploadOutlined />} disabled={!batchUploadFiles.length} onClick={confirmBatchUploadLocalLessons}>确认上传</Button>
            </Space>
          )
        )}
        width={560}
        destroyOnClose
        maskClosable={false}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {Object.values(batchUploadItems).length > 0 && (
            <>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: 500 }}>
                    {batchUploadingLessons ? '上传进度' : '待上传文件'}
                    <Text type="secondary" style={{ fontWeight: 400, marginLeft: 8 }}>
                      {Object.values(batchUploadItems).filter(i => i.status === 'done').length} / {Object.values(batchUploadItems).length}
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 13, color: '#8c8c8c' }}>
                    {Math.round(Object.values(batchUploadItems).reduce((s, i) => s + i.percent, 0) / Math.max(1, Object.values(batchUploadItems).length))}%
                  </Text>
                </div>
                <Progress
                  percent={Math.round(Object.values(batchUploadItems).reduce((s, i) => s + i.percent, 0) / Math.max(1, Object.values(batchUploadItems).length))}
                  size="small" strokeWidth={4}
                  status={Object.values(batchUploadItems).some(i => i.status === 'error') ? 'exception' : batchUploadingLessons ? 'active' : 'success'}
                  style={{ margin: 0 }}
                />
              </div>
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {Object.values(batchUploadItems).map(item => (
                  <div key={item.uid} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <Text ellipsis style={{ maxWidth: 380, fontSize: 12 }}>{item.name}</Text>
                      <Text style={{
                        fontSize: 12,
                        color: item.status === 'error' ? '#ff4d4f' : item.status === 'done' ? '#52c41a' : '#8c8c8c',
                        marginLeft: 8, whiteSpace: 'nowrap',
                      }}>
                        {item.status === 'preparing' ? '准备上传' :
                         item.status === 'uploading' ? `${item.percent}%` :
                         item.status === 'processing' ? '上传至 VOD' :
                         item.status === 'done' ? '✅ 完成' :
                         item.status === 'error' ? '❌ 失败' :
                         '待上传'}
                      </Text>
                    </div>
                    <Progress percent={item.percent} size="small" strokeWidth={3} showInfo={false}
                      status={item.status === 'error' ? 'exception' : item.status === 'done' ? 'success' : 'active'}
                      style={{ margin: 0 }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
          {Object.values(batchUploadItems).length === 0 && (
            <Empty description="暂无上传任务" />
          )}
        </Space>
      </Modal>

    </div>
  );
}
