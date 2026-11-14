'use client';

import { createHoldPlaybackSpeed } from '@/lib/hold-playback-speed';

import { usePageShare } from '@/components/PageShareData';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  AlertTriangle,
  BookOpen,
  Cast,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Headphones,
  ListVideo,
  Loader2,
  Maximize,
  PictureInPicture2,
  Minimize,
  Pause,
  Play,
  Copy,
  MessageSquareText,
  PhoneCall,
  PlayCircle,
  RefreshCw,
  Search,
  SkipBack,
  SkipForward,
  Sun,
  StickyNote,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { courseKnowledgeById, courses } from '@/config/courses';
import { studentApi } from '@/lib/student-api';
import { useLessonCompletion } from '@/lib/use-lesson-completion';
import { toggleCoursePictureInPicture } from '@/lib/course-picture-in-picture';
import { enterCourseStageFullscreen } from '@/lib/course-stage-fullscreen';
import StudentLoginModal from '@/components/StudentLoginModal';
import { openCourseCastPicker } from '@/lib/course-cast-picker';
import AdaptiveCourseVideo from '@/components/media/AdaptiveCourseVideo';
import {
  buildCourseSyncDiagnostics,
  CourseSyncFailure,
  normalizeCourseSyncFailure,
  syncCourseData,
} from '@/lib/course-sync';
import {
  getCourseVideoHref,
  getPlatformSeriesIdForLegacyCourse,
} from '@/lib/course-series-ids';
import { findCourseVideoSelection } from '@/lib/course-video-selection';
import {
  isIntentionalVerticalPlaybackGesture,
  playbackLevelFromVerticalDrag,
} from '@/lib/course-video-controls';
import { queueLearningProgress } from '@/lib/learning-progress-queue';
import { isStandalonePwa } from '@/lib/pwa-auth-flow';
import {
  ANDROID_SYSTEM_CAST_MESSAGE,
  isAndroidUserAgent,
  isAppleMobileUserAgent,
  remotePlaybackErrorMessage,
  type RemotePlaybackAvailability,
} from '@/lib/remote-playback';

type PlayInfo = {
  video_url: string;
  duration?: number;
  material_id?: string | number;
  qualities?: QualityOption[];
  quality_options?: QualityOption[];
};

type QualityOption = {
  label: string;
  value: string;
  url: string;
  definition?: string;
  format?: string;
};

type ProgressInfo = {
  progress?: number;
  duration?: number;
  completed?: boolean;
  last_play_at?: string;
};

type VideoProgressRow = {
  video_id: string | number;
  progress?: number;
  duration?: number;
  completed?: number | boolean;
  last_play_at?: string;
};

type CourseVideo = {
  id: string | number;
  material_id?: string | number;
  name: string;
  duration?: number | string;
};

type CourseChapter = {
  id: string | number;
  name: string;
  description?: string;
  sort_order?: number;
  videos?: CourseVideo[];
};

type TimedItem = {
  id: string | number;
  timestamp_seconds: number;
  content?: string;
  label?: string;
  created_at?: string;
  member_name?: string;
  member_phone?: string;
};

type ActivePanel = 'catalog' | 'notes' | 'intro';
type SelectVideoOptions = {
  scrollToPlayer?: boolean;
};

type PlayerVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
  remote?: {
    state?: 'connecting' | 'connected' | 'disconnected';
    prompt?: () => Promise<void>;
    watchAvailability?: (callback: (available: boolean) => void) => Promise<number>;
    cancelWatchAvailability?: (callbackId?: number) => Promise<void>;
    addEventListener?: (type: string, listener: EventListener) => void;
    removeEventListener?: (type: string, listener: EventListener) => void;
  };
};

type FullscreenContainer = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type PlaybackGestureSide = 'brightness' | 'volume';

type PlaybackGesture = {
  pointerId: number;
  side: PlaybackGestureSide;
  startX: number;
  startY: number;
  startValue: number;
  moved: boolean;
};

const CATALOG_PAGE_SIZE = 50;
const PLAYBACK_RATE_OPTIONS = [0.75, 1, 1.25, 1.5] as const;
const AUTH_CONTACT_TEXT = '联系客服老师  申请授权学习';
const customerServiceQRCodes = [
  { name: 'Monica 海艳老师', src: '/images/contact/wechat-monica-haiyan.jpg', note: '课程咨询' },
  { name: 'Elin 伊琳老师', src: '/images/contact/wechat-elin-yilin.jpg', note: '报名咨询' },
];
const customerServicePhones = [
  { name: '海艳老师', phone: '+8615367870529', display: '153 6787 0529' },
  { name: '伊琳老师', phone: '+8619310029982', display: '193 1002 9982' },
];

function authHeaders(token: string | null, json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function readJson<T>(url: string, token: string | null): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(token), cache: 'no-store' });
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.message || payload?.error || `请求失败 (${res.status})`);
  }
  return (payload?.data ?? payload) as T;
}

async function postJson(url: string, token: string | null, body: Record<string, unknown>, keepalive = false) {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(body),
    keepalive,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.message || payload?.error || `保存失败 (${res.status})`);
  }
  return payload;
}

function formatDuration(value?: number | string): string {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function progressPercent(row: VideoProgressRow | undefined, fallbackDuration?: number | string): number {
  if (!row) return 0;
  if (row.completed) return 100;
  const watched = Number(row.progress || 0);
  const duration = Number(row.duration || fallbackDuration || 0);
  if (!Number.isFinite(watched) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((watched / duration) * 100)));
}

function displayName(value: string) {
  return value.replace(/\.(mp4|m4v|mov|webm|m4a|mp3)$/i, '').trim();
}

function normalizeCatalogSearch(value: string) {
  return value.trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, '');
}

function formatNoteCreatedAt(value?: string): string {
  if (!value) return '';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function noteAuthor(note: TimedItem, fallback = '学员') {
  return note.member_name || fallback;
}

function normalizeVodPlaybackUrl(value: string) {
  if (!value) return value;
  try {
    const url = new URL(value, window.location.href);
    if (url.hostname.toLowerCase() !== 'vod.dongfangwuquan.com') return value;
    url.hostname = 'vod.swod.com.cn';
    return url.toString();
  } catch {
    return value;
  }
}

export default function WebsiteCourseVideoPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = String(params?.id || '');
  const selectedVideoParam = searchParams.get('video') || '';
  const isPlatformSource = searchParams.get('source') === 'platform';
  const mappedLegacySeriesId = getPlatformSeriesIdForLegacyCourse(courseId);
  const requestedPlatformSeriesId = isPlatformSource
    ? (/^\d+$/.test(courseId) && Number(courseId) > 0 ? Number(courseId) : null)
    : (mappedLegacySeriesId ?? null);
  const staticCourse = isPlatformSource ? undefined : courses.find(item => item.id === courseId);
  const [platformCourse, setPlatformCourse] = useState<any | null>(null);
  const [platformCourseLoading, setPlatformCourseLoading] = useState(true);
  const [platformSyncFailure, setPlatformSyncFailure] = useState<CourseSyncFailure | null>(null);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const [diagnosticsCopyError, setDiagnosticsCopyError] = useState(false);
  const course = platformCourse || staticCourse;
  const learningSeriesId = Number(platformCourse?.platformSeriesId) > 0
    ? Number(platformCourse.platformSeriesId)
    : null;
  const knowledge = course ? courseKnowledgeById[String((course as any).legacyCourseId || course.id)] : undefined;

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerStageRef = useRef<HTMLDivElement>(null);
  const memberIdRef = useRef('');
  const memberNameRef = useRef('');
  const tokenRef = useRef<string | null>(null);
  const restoredRef = useRef(false);
  const shouldAutoplayRef = useRef(false);
  const pendingQualitySwitchRef = useRef<{ seconds: number; shouldPlay: boolean } | null>(null);
  const resumeAfterSeekRef = useRef(false);
  const playbackGestureRef = useRef<PlaybackGesture | null>(null);
  const pendingScrollToPlayerRef = useRef(false);
  const platformSyncControllerRef = useRef<AbortController | null>(null);
  const requestedEntryVideoRef = useRef(selectedVideoParam);
  const videoActionsTimerRef = useRef<number | null>(null);
  const gestureIndicatorTimerRef = useRef<number | null>(null);
  const remoteMessageTimerRef = useRef<number | null>(null);
  const videoLoadRequestRef = useRef(0);
  const activeVideoIdRef = useRef('');
  const durationRef = useRef(0);
  const playInfoDurationRef = useRef(0);
  const progressByVideoRef = useRef<Map<string, VideoProgressRow>>(new Map());
  const lastProgressSaveRef = useRef('');

  const [chapters, setChapters] = useState<CourseChapter[]>([]);
  const [progressRows, setProgressRows] = useState<VideoProgressRow[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([]);
  const [selectedQuality, setSelectedQuality] = useState('');
  const [qualityLabel, setQualityLabel] = useState('标清');
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [isCourseFullscreen, setIsCourseFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);
  const [isHuaweiHonorBrowser, setIsHuaweiHonorBrowser] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [playInfo, setPlayInfo] = useState<PlayInfo | null>(null);
  const [notes, setNotes] = useState<TimedItem[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [smallWindowMessage, setSmallWindowMessage] = useState('');
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activePanel, setActivePanel] = useState<ActivePanel>('catalog');
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState('');
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [requestedVideoId, setRequestedVideoId] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<CourseVideo | null>(null);
  const [loginReloadKey, setLoginReloadKey] = useState(0);
  const [showAuthorizationContact, setShowAuthorizationContact] = useState(false);
  const [showVideoActions, setShowVideoActions] = useState(false);
  const [remotePlaybackSupported, setRemotePlaybackSupported] = useState(false);
  const [remotePlaybackAvailability, setRemotePlaybackAvailability] = useState<RemotePlaybackAvailability>('unknown');
  const [remotePlaybackState, setRemotePlaybackState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [remotePlaybackMessage, setRemotePlaybackMessage] = useState('');
  const [isAndroidBrowser, setIsAndroidBrowser] = useState(false);
  const [videoBrightness, setVideoBrightness] = useState(1);
  const [gestureIndicator, setGestureIndicator] = useState<{ side: PlaybackGestureSide; value: number } | null>(null);

  const [holdingSpeed, setHoldingSpeed] = useState(false);
  const holdSpeedRef = useRef<ReturnType<typeof createHoldPlaybackSpeed> | null>(null);
  if (!holdSpeedRef.current) holdSpeedRef.current = createHoldPlaybackSpeed(() => videoRef.current, setHoldingSpeed);
  useEffect(() => {
    const end = () => holdSpeedRef.current?.end();
    const visibility = () => { if (document.hidden) end(); };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', end);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      holdSpeedRef.current?.end();
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', end);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [videoUrl]);

  const stopCurrentPlayback = useCallback(() => {
    holdSpeedRef.current?.end();
    videoLoadRequestRef.current += 1;
    const video = videoRef.current;
    if (video) video.pause();
    resumeAfterSeekRef.current = false;
    playbackGestureRef.current = null;
    setIsVideoPlaying(false);
  }, []);

  useEffect(() => {
    // HarmonyOS/Huawei Android WebViews can keep the document scrolling box in
    // a clipped PWA state after media interaction. Mark this route explicitly
    // so CSS can restore native vertical document scrolling for the catalogue.
    document.documentElement.classList.add('course-video-scroll-page');
    return () => document.documentElement.classList.remove('course-video-scroll-page');
  }, []);

  useEffect(() => {
    // Search is a temporary view filter. Persisting it made later visits look
    // as if most course chapters had disappeared.
    requestedEntryVideoRef.current = selectedVideoParam;
    setCatalogQuery('');
    setCatalogPage(1);
    setRequestedVideoId(selectedVideoParam);
  }, [courseId, isPlatformSource]);

  useEffect(() => {
    const landscapeQuery = window.matchMedia('(orientation: landscape) and (max-height: 600px)');
    const syncPlaybackLayout = () => {
      document.body.classList.toggle(
        'course-video-landscape-playback',
        Boolean(videoUrl) && landscapeQuery.matches && !isStandalonePwa(),
      );
    };

    syncPlaybackLayout();
    landscapeQuery.addEventListener?.('change', syncPlaybackLayout);
    window.addEventListener('orientationchange', syncPlaybackLayout);
    return () => {
      landscapeQuery.removeEventListener?.('change', syncPlaybackLayout);
      window.removeEventListener('orientationchange', syncPlaybackLayout);
      document.body.classList.remove('course-video-landscape-playback');
    };
  }, [videoUrl]);

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    setIsHuaweiHonorBrowser(/HUAWEI|HONOR|HarmonyOS|HuaweiBrowser/i.test(userAgent));
    setIsAndroidBrowser(isAndroidUserAgent(userAgent));
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsCourseFullscreen(document.fullscreenElement === playerStageRef.current || isFallbackFullscreen);
    };
    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
    };
  }, [isFallbackFullscreen]);

  useEffect(() => {
    document.body.classList.toggle('course-video-fallback-fullscreen-open', isFallbackFullscreen);
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFallbackFullscreen(false);
    };
    window.addEventListener('keydown', exitOnEscape);
    return () => {
      window.removeEventListener('keydown', exitOnEscape);
      document.body.classList.remove('course-video-fallback-fullscreen-open');
    };
  }, [isFallbackFullscreen]);

  const syncPlatformCourse = useCallback(async () => {
    if (!requestedPlatformSeriesId) {
      setPlatformCourse(null);
      setPlatformCourseLoading(false);
      setPlatformSyncFailure(null);
      setLoading(false);
      setError('该课程尚未关联数字化平台系列');
      return;
    }
    platformSyncControllerRef.current?.abort();
    const controller = new AbortController();
    platformSyncControllerRef.current = controller;
    setPlatformCourseLoading(true);
    setPlatformSyncFailure(null);
    setDiagnosticsCopied(false);
    setDiagnosticsCopyError(false);
    try {
      const data = await syncCourseData<any>(`/api/platform-courses/${encodeURIComponent(String(requestedPlatformSeriesId))}`, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setPlatformCourse(data || null);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('加载数字化平台课程详情失败:', error);
      setPlatformCourse(null);
      setPlatformSyncFailure(normalizeCourseSyncFailure(error));
    } finally {
      if (!controller.signal.aborted) setPlatformCourseLoading(false);
    }
  }, [requestedPlatformSeriesId]);

  useEffect(() => {
    syncPlatformCourse();
    return () => platformSyncControllerRef.current?.abort();
  }, [syncPlatformCourse]);

  const copyPlatformSyncDiagnostics = useCallback(async () => {
    if (!platformSyncFailure) return;
    const diagnostics = buildCourseSyncDiagnostics(platformSyncFailure, { courseId });
    try {
      await navigator.clipboard.writeText(diagnostics);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = diagnostics;
      textarea.readOnly = true;
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      textarea.style.fontSize = '16px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copied = document.execCommand('copy');
      textarea.remove();
      if (!copied) {
        setDiagnosticsCopyError(true);
        return;
      }
    }
    setDiagnosticsCopyError(false);
    setDiagnosticsCopied(true);
    window.setTimeout(() => setDiagnosticsCopied(false), 2000);
  }, [courseId, platformSyncFailure]);

  const allVideos = useMemo(() => chapters.flatMap(chapter => chapter.videos || []), [chapters]);
  const activeVideo = useMemo(() => {
    if (!allVideos.length) return null;
    const selectedId = requestedVideoId || selectedVideoParam;
    return findCourseVideoSelection(allVideos, selectedId) || allVideos[0];
  }, [allVideos, requestedVideoId, selectedVideoParam]);
  const activeVideoId = activeVideo ? String(activeVideo.id) : '';
  const activeVideoIndex = useMemo(
    () => allVideos.findIndex(video => String(video.id) === activeVideoId),
    [activeVideoId, allVideos],
  );
  const previousVideo = activeVideoIndex > 0 ? allVideos[activeVideoIndex - 1] : null;
  const nextVideo = activeVideoIndex >= 0 && activeVideoIndex < allVideos.length - 1
    ? allVideos[activeVideoIndex + 1]
    : null;
  const activeChapter = useMemo(() => {
    if (!activeVideoId) return null;
    return chapters.find(chapter => (chapter.videos || []).some(video => String(video.id) === activeVideoId)) || null;
  }, [activeVideoId, chapters]);
  usePageShare(course ? {
    title: course.title,
    desc: course.description || '查看课程介绍和完整目录，了解东方舞系统学习。',
    link: learningSeriesId ? `/courses/${encodeURIComponent(learningSeriesId)}?source=platform` : `/courses/${encodeURIComponent(courseId)}`,
    imgUrl: course.image || '',
  } : null);
  const catalogEntries = useMemo(() => {
    const keyword = normalizeCatalogSearch(catalogQuery);
    return chapters.flatMap((chapter, chapterIndex) => {
      const videos = chapter.videos || [];
      const primaryVideo = videos[0];
      if (!keyword) return [{ chapter, chapterIndex, selectedVideo: primaryVideo, catalogTitle: chapter.name }];

      const chapterMatches = normalizeCatalogSearch(chapter.name || '').includes(keyword);
      const matchedVideo = videos.find(video => normalizeCatalogSearch(displayName(video.name || '')).includes(keyword));
      const numberMatches = String(chapterIndex + 1) === keyword;
      if (!chapterMatches && !matchedVideo && !numberMatches) return [];
      return [{
        chapter,
        chapterIndex,
        selectedVideo: matchedVideo || primaryVideo,
        catalogTitle: !chapterMatches && matchedVideo ? displayName(matchedVideo.name) : chapter.name,
      }];
    });
  }, [catalogQuery, chapters]);
  const catalogPageCount = Math.max(1, Math.ceil(catalogEntries.length / CATALOG_PAGE_SIZE));
  const currentCatalogPage = Math.min(catalogPage, catalogPageCount);
  const catalogStartIndex = (currentCatalogPage - 1) * CATALOG_PAGE_SIZE;
  const paginatedCatalogEntries = catalogEntries.slice(catalogStartIndex, catalogStartIndex + CATALOG_PAGE_SIZE);
  const showCatalogPagination = catalogEntries.length > CATALOG_PAGE_SIZE;

  const progressByVideo = useMemo(() => {
    const map = new Map<string, VideoProgressRow>();
    progressRows.forEach(row => {
      if (row.video_id !== undefined && row.video_id !== null) map.set(String(row.video_id), row);
    });
    return map;
  }, [progressRows]);
  activeVideoIdRef.current = activeVideoId;
  durationRef.current = duration;
  playInfoDurationRef.current = Number(playInfo?.duration || 0);
  progressByVideoRef.current = progressByVideo;

  const resumeVideo = useMemo(() => {
    const playableVideos = allVideos.filter(video => video.id !== undefined && video.id !== null);
    if (!playableVideos.length) return null;
    const watched = playableVideos
      .map(video => ({ video, row: progressByVideo.get(String(video.id)) }))
      .filter(item => Number(item.row?.progress || 0) > 0)
      .sort((a, b) => {
        const bTime = b.row?.last_play_at ? new Date(b.row.last_play_at).getTime() : 0;
        const aTime = a.row?.last_play_at ? new Date(a.row.last_play_at).getTime() : 0;
        if (bTime !== aTime) return bTime - aTime;
        return Number(b.row?.progress || 0) - Number(a.row?.progress || 0);
      });
    return watched[0]?.video || playableVideos[0];
  }, [allVideos, progressByVideo]);

  const videoProgressPercent = useCallback((video: CourseVideo | null | undefined) => {
    if (!video) return 0;
    const row = progressByVideo.get(String(video.id));
    const videoDuration = Math.max(
      Number(row?.duration || 0),
      Number(video.duration || 0),
      String(video.id) === activeVideoId ? Number(duration || playInfo?.duration || 0) : 0,
    );
    if (row?.completed) return 100;
    const watched = Math.max(
      Number(row?.progress || 0),
      String(video.id) === activeVideoId ? Number(currentSeconds || resumeSeconds || 0) : 0,
    );
    if (!Number.isFinite(watched) || !Number.isFinite(videoDuration) || videoDuration <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((watched / videoDuration) * 100)));
  }, [activeVideoId, currentSeconds, duration, playInfo?.duration, progressByVideo, resumeSeconds]);

  const completionPercent = useMemo(() => {
    let watchedTotal = 0;
    let durationTotal = 0;
    allVideos.forEach(video => {
      const row = progressByVideo.get(String(video.id));
      const videoDuration = Math.max(
        Number(row?.duration || 0),
        Number(video.duration || 0),
        String(video.id) === activeVideoId ? Number(duration || playInfo?.duration || 0) : 0,
      );
      if (!Number.isFinite(videoDuration) || videoDuration <= 0) return;
      durationTotal += videoDuration;
      if (row?.completed) {
        watchedTotal += videoDuration;
        return;
      }
      const watched = Math.max(
        Number(row?.progress || 0),
        String(video.id) === activeVideoId ? Number(currentSeconds || resumeSeconds || 0) : 0,
      );
      watchedTotal += Math.min(videoDuration, Math.max(0, watched));
    });
    if (durationTotal <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((watchedTotal / durationTotal) * 100)));
  }, [activeVideoId, allVideos, currentSeconds, duration, playInfo?.duration, progressByVideo, resumeSeconds]);

  const saveProgress = useCallback(async (
    keepalive = false,
    completed = false,
    sample?: { videoId: string; currentTime: number; duration: number },
  ) => {
    const video = videoRef.current;
    const memberId = memberIdRef.current;
    const activeId = sample?.videoId || activeVideoIdRef.current;
    if ((!video && !sample) || !memberId || !activeId) return;
    const previous = progressByVideoRef.current.get(activeId);
    const sampledDuration = Number(sample?.duration || video?.duration || 0);
    const sampledProgress = Number(sample?.currentTime || video?.currentTime || 0);
    const nextProgress = Math.max(
      completed ? Math.floor(sampledDuration || durationRef.current || playInfoDurationRef.current || 0) : 0,
      Math.floor(sampledProgress),
      Number(previous?.progress || 0),
    );
    const nextDuration = Math.max(
      Math.floor(sampledDuration),
      durationRef.current,
      playInfoDurationRef.current,
      Number(previous?.duration || 0),
    );
    if (nextProgress <= 0 && nextDuration <= 0) return;
    const saveKey = `${memberId}:${activeId}:${nextProgress}:${nextDuration}`;
    if (lastProgressSaveRef.current === saveKey) return;
    lastProgressSaveRef.current = saveKey;

    const progressBody = {
      member_id: memberId,
      progress: nextProgress,
      duration: nextDuration,
    };
    const request = postJson(`/api/learn/video/${encodeURIComponent(activeId)}/progress`, tokenRef.current, progressBody, keepalive)
      .catch(() => {
        queueLearningProgress({ videoId: activeId, memberId, progress: nextProgress, duration: nextDuration });
      })
      .then(() => {
      setProgressRows(rows => {
        const completed = nextDuration > 0 && nextProgress >= nextDuration * 0.9;
        const nextRow: VideoProgressRow = {
          video_id: activeId,
          progress: nextProgress,
          duration: nextDuration,
          completed,
          last_play_at: new Date().toISOString(),
        };
        const index = rows.findIndex(row => String(row.video_id) === activeId);
        if (index === -1) return [...rows, nextRow];
        const current = rows[index];
        if (
          Number(current.progress || 0) === nextProgress
          && Number(current.duration || 0) === nextDuration
          && Boolean(current.completed) === completed
        ) return rows;
        const nextRows = [...rows];
        nextRows[index] = { ...current, ...nextRow };
        return nextRows;
      });
    });
    try {
      await request;
    } catch (error) {
      if (lastProgressSaveRef.current === saveKey) lastProgressSaveRef.current = '';
      throw error;
    } finally {
      // A later, more complete sample may be sent while this request is still
      // running (for example when a video ends during the 15-second save).
    }
  }, []);

  const syncStudentAuth = useCallback(() => {
    const token = studentApi.getToken();
    const member = studentApi.getStoredMember();
    tokenRef.current = token;
    memberIdRef.current = member?.id || '';
    memberNameRef.current = member?.name || '';
    return { token, member };
  }, []);

  const requireLogin = useCallback((video?: CourseVideo | null) => {
    if (video) setPendingVideo(video);
    setError('');
    setLoading(false);
    setLoginOpen(true);
  }, []);

  const loadOutlineAndAuth = useCallback(async () => {
    if (!learningSeriesId) return;
    stopCurrentPlayback();
    setLoading(true);
    setError('');
    setChapters([]);
    setProgressRows([]);
    setHasStartedPlayback(false);
    setRequestedVideoId('');
    setVideoUrl('');
    setQualityOptions([]);
    setSelectedQuality('');
    setQualityMenuOpen(false);
    setPlayInfo(null);
    setNotes([]);
    lessonCompletion.reset();
    try {
      const { token, member } = syncStudentAuth();

      const [outlineRows, seriesProgressRows] = await Promise.all([
        readJson<CourseChapter[]>(`/api/learn/series/${encodeURIComponent(String(learningSeriesId))}/catalog-live`, null),
        token && member?.id
          ? readJson<VideoProgressRow[]>(`/api/learn/series/${encodeURIComponent(String(learningSeriesId))}/progress?member_id=${encodeURIComponent(member.id)}`, token).catch(() => [])
          : Promise.resolve([]),
      ]);
      const sorted = (outlineRows || []).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
      setChapters(sorted);
      setProgressRows(seriesProgressRows || []);
      const firstVideo = sorted.flatMap(chapter => chapter.videos || [])[0];
      if (!firstVideo) {
        setError('当前课程暂未配置可播放视频');
      } else if (token && member?.id && !isPlatformSource) {
        // A course opened from “我的线上课程” should immediately present a
        // usable player. Previously the page stopped at a cover telling the
        // learner to click the catalogue, which was easily mistaken for an
        // authorization failure on mobile.
        setRequestedVideoId(current => current || requestedEntryVideoRef.current || String(firstVideo.id));
        setHasStartedPlayback(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '课程学习页加载失败';
      if (message.includes('401') || message.includes('登录')) {
        studentApi.clearAuth();
        setError('');
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isPlatformSource, learningSeriesId, stopCurrentPlayback, syncStudentAuth]);

  const loadVideo = useCallback(async () => {
    const memberId = memberIdRef.current;
    const token = tokenRef.current;
    if (!activeVideoId) return;
    stopCurrentPlayback();
    const requestVersion = videoLoadRequestRef.current;
    const requestedActiveVideoId = activeVideoId;
    setLoading(true);
    setVideoUrl('');
    setQualityOptions([]);
    setSelectedQuality('');
    setQualityLabel('标清');
    setQualityMenuOpen(false);
    setPlayInfo(null);
    setDuration(Number(activeVideo?.duration || 0));
    setResumeSeconds(0);
    setCurrentSeconds(0);
    setNotes([]);
    if (!memberId || !token) {
      requireLogin(activeVideo);
      return;
    }

    setError('');
    restoredRef.current = false;
    try {
      const [playData, progressData, noteRows] = await Promise.all([
        readJson<PlayInfo>(`/api/learn/video/${encodeURIComponent(activeVideoId)}/play?member_id=${encodeURIComponent(memberId)}`, token),
        readJson<ProgressInfo>(`/api/learn/video/${encodeURIComponent(activeVideoId)}/progress?member_id=${encodeURIComponent(memberId)}`, token).catch((): ProgressInfo => ({ progress: 0 })),
        readJson<TimedItem[]>(`/api/learn/notes?member_id=${encodeURIComponent(memberId)}&video_id=${encodeURIComponent(activeVideoId)}`, token).catch(() => []),
      ]);
      if (
        requestVersion !== videoLoadRequestRef.current
        || requestedActiveVideoId !== activeVideoIdRef.current
      ) return;
      const options = (playData.qualities || playData.quality_options || [])
        .filter(option => option?.url)
        .map(option => ({
          ...option,
          url: normalizeVodPlaybackUrl(option.url),
          label: option.label || option.definition?.toUpperCase() || option.format?.toUpperCase() || '自动',
          value: option.value || option.definition || option.format || option.url,
        }));
      const initialUrl = normalizeVodPlaybackUrl(playData.video_url || options[0]?.url || '');
      const initialQuality = options.find(option => option.url === initialUrl) || options[0];
      setPlayInfo(playData);
      setQualityOptions(options);
      setSelectedQuality(initialQuality?.value || '');
      setVideoUrl(initialUrl);
      setQualityLabel(initialQuality?.label || '标清');
      setDuration(Number(progressData.duration || playData.duration || activeVideo?.duration || 0));
      setResumeSeconds(Number(progressData.progress || 0));
      setCurrentSeconds(Number(progressData.progress || 0));
      setNotes(noteRows || []);
      setProgressRows(rows => {
        const nextDuration = Number(progressData.duration || playData.duration || activeVideo?.duration || 0);
        const nextRow: VideoProgressRow = {
          video_id: activeVideoId,
          progress: Number(progressData.progress || 0),
          duration: nextDuration,
          completed: !!progressData.completed,
          last_play_at: progressData.last_play_at,
        };
        const index = rows.findIndex(row => String(row.video_id) === activeVideoId);
        if (index === -1) return [...rows, nextRow];
        const nextRows = [...rows];
        nextRows[index] = { ...nextRows[index], ...nextRow };
        return nextRows;
      });
    } catch (err) {
      if (requestVersion !== videoLoadRequestRef.current) return;
      const message = err instanceof Error ? err.message : '视频加载失败';
      if (message.includes('401') || message.includes('登录')) {
        studentApi.clearAuth();
        syncStudentAuth();
        requireLogin(activeVideo);
        return;
      }
      if (message.includes('403') || message.includes('授权')) {
        setError(AUTH_CONTACT_TEXT);
        return;
      }
      setError(message);
    } finally {
      if (requestVersion === videoLoadRequestRef.current) setLoading(false);
    }
  }, [activeVideo, activeVideo?.duration, activeVideoId, requireLogin, stopCurrentPlayback, syncStudentAuth]);

  useEffect(() => {
    if (!platformCourseLoading && learningSeriesId) loadOutlineAndAuth();
  }, [learningSeriesId, loadOutlineAndAuth, platformCourseLoading]);

  useEffect(() => {
    setCatalogPage(page => Math.min(Math.max(1, page), catalogPageCount));
  }, [catalogPageCount]);

  useEffect(() => {
    if (normalizeCatalogSearch(catalogQuery)) return;
    const selectedId = requestedVideoId || selectedVideoParam;
    if (!selectedId || !chapters.length) return;
    const selectedVideo = findCourseVideoSelection(allVideos, selectedId);
    if (!selectedVideo) return;
    const chapterIndex = chapters.findIndex(chapter => (chapter.videos || []).some(video => String(video.id) === String(selectedVideo.id)));
    if (chapterIndex >= 0) {
      setCatalogPage(Math.floor(chapterIndex / CATALOG_PAGE_SIZE) + 1);
    }
  }, [allVideos, catalogQuery, chapters, requestedVideoId, selectedVideoParam]);

  useEffect(() => {
    if (!hasStartedPlayback) return;
    loadVideo();
  }, [hasStartedPlayback, loadVideo, loginReloadKey]);

  useEffect(() => {
    if (!videoUrl) return;
    const timer = window.setInterval(() => {
      saveProgress().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [saveProgress, videoUrl]);

  useEffect(() => {
    const handleLeave = () => {
      saveProgress(true).catch(() => undefined);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') handleLeave();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleLeave);
    window.addEventListener('pagehide', handleLeave);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleLeave);
      window.removeEventListener('pagehide', handleLeave);
      handleLeave();
    };
  }, [saveProgress]);

  const selectVideo = (video: CourseVideo, options: SelectVideoOptions = {}) => {
    const { token, member } = syncStudentAuth();
    if (!token || !member?.id) {
      pendingScrollToPlayerRef.current = Boolean(options.scrollToPlayer);
      requireLogin(video);
      return;
    }
    if (options.scrollToPlayer) {
      // The player is the first content block below the fixed navigation.
      // Jumping to the document top keeps the complete video area visible.
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    saveProgress().catch(() => undefined);
    stopCurrentPlayback();
    setRequestedVideoId(String(video.id));
    setHasStartedPlayback(true);
    lessonCompletion.reset();
    shouldAutoplayRef.current = true;
    const nextHref = getCourseVideoHref({
      courseId,
      legacyCourseId: platformCourse?.legacyCourseId,
      platformSeriesId: learningSeriesId,
      videoId: video.id,
    });
    // The History API avoids asking Next.js to render this same route again.
    window.history.replaceState(window.history.state, '', nextHref);
  };

  const lessonCompletion = useLessonCompletion<CourseVideo>(activeVideoId, target => selectVideo(target, { scrollToPlayer: true }));
  const { ended: lessonEnded, countdown: autoplayCountdown } = lessonCompletion;
  const replayLesson = () => {
    lessonCompletion.reset();
    setResumeSeconds(0);
    setCurrentSeconds(0);
    const video = videoRef.current;
    if (video) { video.currentTime = 0; video.play().catch(() => undefined); }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  const handlePlaybackEnded = (video: HTMLVideoElement, endedVideoId: string) => {
    saveProgress(true, true, {
      videoId: endedVideoId,
      currentTime: video.currentTime,
      duration: video.duration,
    }).catch(() => undefined);
    lessonCompletion.finish(nextVideo || null);
    revealVideoActions();
  };

  const continueLastStudy = () => {
    if (!resumeVideo) return;
    selectVideo(resumeVideo);
  };

  const updateCatalogQuery = (value: string) => {
    setCatalogQuery(value);
    setCatalogPage(1);
    setActivePanel('catalog');
  };

  const seekTo = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    setCurrentSeconds(seconds);
  };

  const refreshNotes = async () => {
    const memberId = memberIdRef.current;
    if (!memberId || !activeVideoId) return;
    const rows = await readJson<TimedItem[]>(`/api/learn/notes?member_id=${encodeURIComponent(memberId)}&video_id=${encodeURIComponent(activeVideoId)}`, tokenRef.current);
    setNotes(rows || []);
  };

  const addNote = async () => {
    const memberId = memberIdRef.current;
    if (!memberId) {
      requireLogin(activeVideo);
      return;
    }
    if (!activeVideoId || !noteContent.trim()) return;
    setSavingNote(true);
    try {
      await postJson('/api/learn/notes', tokenRef.current, {
        member_id: memberId,
        video_id: activeVideoId,
        timestamp_seconds: Math.floor(videoRef.current?.currentTime || currentSeconds),
        content: noteContent.trim(),
      });
      setNoteContent('');
      await refreshNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : '笔记保存失败');
    } finally {
      setSavingNote(false);
    }
  };

  const renderCatalogPagination = () => {
    if (!showCatalogPagination) return null;
    const from = catalogStartIndex + 1;
    const to = Math.min(catalogEntries.length, catalogStartIndex + CATALOG_PAGE_SIZE);
    return (
      <div className="flex items-center justify-between rounded-md border border-[#E8DDCB] bg-[#FFFDF8] px-2 py-1.5 text-xs text-[#8C8172]">
        <button
          type="button"
          disabled={currentCatalogPage <= 1}
          onClick={() => setCatalogPage(page => Math.max(1, page - 1))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E8DDCB] bg-white text-[#A98746] transition hover:border-[#C8A96E] hover:text-[#8B1A1A] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="上一页课节"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-semibold text-[#A98746]">
          {from}-{to} / {catalogEntries.length}
        </span>
        <button
          type="button"
          disabled={currentCatalogPage >= catalogPageCount}
          onClick={() => setCatalogPage(page => Math.min(catalogPageCount, page + 1))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E8DDCB] bg-white text-[#A98746] transition hover:border-[#C8A96E] hover:text-[#8B1A1A] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="下一页课节"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const renderStudyToolbar = (className = '') => (
    <div className={`course-video-study-toolbar flex flex-nowrap items-center justify-start gap-2 md:gap-3 ${className}`}>
      <Link href="/courses" aria-label="返回线上学院" className="course-video-toolbar-back inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E8DDCB] bg-white text-[#8C8172] transition hover:border-[#C8A96E] hover:text-[#8B1A1A] md:h-10 md:w-10">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="course-video-toolbar-actions flex min-w-0 flex-1 flex-nowrap items-center justify-start gap-1.5 md:gap-2">
        <div className="course-video-toolbar-progress flex h-8 items-center gap-1.5 rounded-full border border-[#E8DDCB] bg-white px-2.5 text-xs font-semibold text-[#A98746] md:h-auto md:gap-2 md:px-3 md:py-1">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
          <span>进度 {completionPercent}%</span>
        </div>
        <button
          type="button"
          disabled={!resumeVideo}
          onClick={continueLastStudy}
          className="course-video-toolbar-resume h-7 rounded-full border border-[#E8DDCB] bg-white px-2.5 text-xs font-bold text-[#8B1A1A] transition hover:border-[#C8A96E] hover:bg-[#FFF8EA] disabled:cursor-not-allowed disabled:opacity-50 md:h-8 md:px-3"
        >
          续播
        </button>
      </div>
      <label className="course-video-toolbar-search relative flex h-8 w-28 shrink-0 items-center rounded-md border border-[#E8DDCB] bg-white text-[#8C8172] shadow-sm transition focus-within:border-[#C8A96E] md:h-10 md:w-64">
        <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[#A98746] md:left-3 md:h-4 md:w-4" />
        <input
          type="search"
          value={catalogQuery}
          onChange={(event) => updateCatalogQuery(event.target.value)}
          placeholder="搜索课节"
          className="h-full w-full rounded-md bg-transparent py-0 pl-7 pr-7 text-xs text-[#2C1810] outline-none placeholder:text-[#A99D8E] md:pl-9 md:pr-9 md:text-sm"
          aria-label="搜索筛选本课程课节目录"
        />
        {catalogQuery ? (
          <button
            type="button"
            onClick={() => updateCatalogQuery('')}
            className="absolute right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F1E9DD] text-[#8C8172] transition hover:bg-[#E8DDCB] hover:text-[#8B1A1A] md:right-2"
            aria-label="清空课节搜索"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </label>
    </div>
  );

  const renderAuthorizationContact = () => (
    <div className="fixed inset-x-4 bottom-20 z-[70] rounded-2xl border border-[#E8DDCB] bg-white p-4 text-[#2C1810] shadow-2xl shadow-crimson/10 md:bottom-auto md:left-auto md:right-6 md:top-1/2 md:w-80 md:-translate-y-1/2">
      <button
        type="button"
        onClick={() => setShowAuthorizationContact(false)}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#F8F3EA] text-[#8C8172] transition hover:text-[#8B1A1A]"
        aria-label="关闭客服信息"
      >
        <X className="h-4 w-4" />
      </button>
      <h3 className="mb-3 flex items-center gap-2 pr-8 font-serif text-lg font-bold">
        <Headphones className="h-5 w-5 text-[#8B1A1A]" />
        联系客服老师
      </h3>
      <div className="mb-4 space-y-2">
        {customerServicePhones.map((item) => (
          <a
            key={item.phone}
            href={`tel:${item.phone}`}
            className="flex items-center justify-between rounded-xl border border-[#EFE6D8] bg-[#FFFDF8] px-3 py-2 text-sm font-semibold transition hover:border-[#C8A96E] hover:text-[#8B1A1A]"
            aria-label={`拨打${item.name}电话${item.display}`}
          >
            <span className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-[#8B1A1A]" />
              {item.name}
            </span>
            <span className="text-[#8B1A1A]">{item.display}</span>
          </a>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {customerServiceQRCodes.map((qr) => (
          <div key={qr.name} className="text-center">
            <div className="overflow-hidden rounded-xl border border-[#EFE6D8] bg-[#FFFDF8]">
              <Image
                src={qr.src}
                alt={`${qr.name}微信二维码`}
                width={360}
                height={480}
                className="aspect-[3/4] w-full object-contain"
              />
            </div>
            <p className="mt-2 text-xs font-bold">{qr.name}</p>
            <p className="text-[11px] text-[#8C8172]">{qr.note}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const playFromCatalog = (video: HTMLVideoElement) => {
    if (!shouldAutoplayRef.current) return;
    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1;
    video.play().then(() => {
      shouldAutoplayRef.current = false;
    }).catch(() => undefined);
  };

  const resumePlaybackAfterSeek = (video: HTMLVideoElement) => {
    const shouldResume = resumeAfterSeekRef.current;
    resumeAfterSeekRef.current = false;
    if (shouldResume && !video.ended) video.play().catch(() => undefined);
  };

  const changeQuality = (value: string) => {
    holdSpeedRef.current?.end();
    const next = qualityOptions.find(option => option.value === value);
    setQualityMenuOpen(false);
    if (!next?.url) return;
    setSelectedQuality(next.value);
    setQualityLabel(next.label);
    if (next.url === videoUrl) return;

    const video = videoRef.current;
    pendingQualitySwitchRef.current = {
      seconds: Math.floor(video?.currentTime || currentSeconds || resumeSeconds || 0),
      shouldPlay: Boolean(video && !video.paused && !video.ended),
    };
    setVideoUrl(next.url);
  };

  const changePlaybackRate = (rate: number) => {
    holdSpeedRef.current?.end();
    setPlaybackRate(rate);
    setSpeedMenuOpen(false);
    const video = videoRef.current;
    if (video) {
      video.defaultPlaybackRate = rate;
      video.playbackRate = rate;
    }
    revealVideoActions();
  };

  const toggleMirrorPlayback = () => {
    setQualityMenuOpen(false);
    setSpeedMenuOpen(false);
    setIsMirrored(mirrored => !mirrored);
    revealVideoActions();
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
    revealVideoActions();
  };

  const seekPlayback = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(seconds)) return;
    video.currentTime = Math.min(Math.max(0, seconds), video.duration || duration || seconds);
    setCurrentSeconds(Math.floor(video.currentTime));
    revealVideoActions();
  };

  const togglePlaybackMuted = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsVideoMuted(video.muted);
    revealVideoActions();
  };

  const revealVideoActions = useCallback(() => {
    setShowVideoActions(true);
    if (videoActionsTimerRef.current !== null) window.clearTimeout(videoActionsTimerRef.current);
    videoActionsTimerRef.current = window.setTimeout(() => {
      setShowVideoActions(false);
      videoActionsTimerRef.current = null;
    }, 3200);
  }, []);

  const toggleVideoActions = useCallback(() => {
    setShowVideoActions(visible => {
      if (videoActionsTimerRef.current !== null) {
        window.clearTimeout(videoActionsTimerRef.current);
        videoActionsTimerRef.current = null;
      }
      if (visible) return false;
      videoActionsTimerRef.current = window.setTimeout(() => {
        setShowVideoActions(false);
        videoActionsTimerRef.current = null;
      }, 3200);
      return true;
    });
  }, []);

  useEffect(() => {
    const video = videoRef.current as PlayerVideoElement | null;
    if (!video) return;
    const restoreCustomControls = () => {
      video.controls = false;
      revealVideoActions();
    };
    video.addEventListener('webkitendfullscreen', restoreCustomControls);
    return () => video.removeEventListener('webkitendfullscreen', restoreCustomControls);
  }, [videoUrl, revealVideoActions]);

  const showGestureIndicator = useCallback((side: PlaybackGestureSide, value: number) => {
    setGestureIndicator({ side, value });
    if (gestureIndicatorTimerRef.current !== null) window.clearTimeout(gestureIndicatorTimerRef.current);
    gestureIndicatorTimerRef.current = window.setTimeout(() => {
      setGestureIndicator(null);
      gestureIndicatorTimerRef.current = null;
    }, 800);
  }, []);

  const startPlaybackGesture = (event: ReactPointerEvent<HTMLVideoElement>) => {
    if (!event.isPrimary || event.button !== 0) { holdSpeedRef.current?.end(); return; }
    const video = videoRef.current;
    const stage = playerStageRef.current;
    if (!video || !stage) return;
    holdSpeedRef.current?.begin(event.clientX, event.clientY);
    const bounds = stage.getBoundingClientRect();
    // Keep the independent transport strip untouched. Taps elsewhere are left
    // alone unless the pointer develops into a clear vertical drag.
    if (event.clientY - bounds.top >= bounds.height * 0.82) {
      resumeAfterSeekRef.current = !video.paused && !video.ended;
      return;
    }
    // Inline mobile playback must leave vertical swipes to the document so
    // learners can move between the player and the catalogue. Brightness and
    // volume gestures remain available in the dedicated fullscreen layer.
    if (event.pointerType === 'touch' && !isCourseFullscreen) return;
    const side: PlaybackGestureSide = event.clientX - bounds.left < bounds.width / 2
      ? 'brightness'
      : 'volume';
    playbackGestureRef.current = {
      pointerId: event.pointerId,
      side,
      startX: event.clientX,
      startY: event.clientY,
      startValue: side === 'volume' ? video.volume : videoBrightness,
      moved: false,
    };
  };

  const updatePlaybackGesture = (event: ReactPointerEvent<HTMLVideoElement>) => {
    holdSpeedRef.current?.move(event.clientX, event.clientY);
    const gesture = playbackGestureRef.current;
    const video = videoRef.current;
    const stage = playerStageRef.current;
    if (!gesture || !video || !stage || gesture.pointerId !== event.pointerId) return;
    if (!gesture.moved) {
      const horizontalDelta = event.clientX - gesture.startX;
      const verticalDelta = event.clientY - gesture.startY;
      if (Math.max(Math.abs(horizontalDelta), Math.abs(verticalDelta)) < 12) return;
      if (!isIntentionalVerticalPlaybackGesture(horizontalDelta, verticalDelta)) {
        playbackGestureRef.current = null;
        return;
      }
      gesture.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      revealVideoActions();
    }
    event.preventDefault();
    const value = playbackLevelFromVerticalDrag(
      gesture.startValue,
      gesture.startY,
      event.clientY,
      stage.getBoundingClientRect().height,
      gesture.side === 'volume' ? 0 : 0.4,
      gesture.side === 'volume' ? 1 : 1.4,
    );
    if (gesture.side === 'volume') {
      video.muted = false;
      video.defaultMuted = false;
      video.volume = value;
      setIsVideoMuted(false);
    } else {
      setVideoBrightness(value);
    }
    showGestureIndicator(gesture.side, value);
  };

  const endPlaybackGesture = (event: ReactPointerEvent<HTMLVideoElement>) => {
    holdSpeedRef.current?.end();
    const gesture = playbackGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.moved) event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    playbackGestureRef.current = null;
  };

  const toggleSmallWindow = async () => {
    const video = videoRef.current;
    if (!video) return;
    setSmallWindowMessage('');
    saveProgress(true).catch(() => undefined);
    try {
      await toggleCoursePictureInPicture(video, document);
    } catch (error) {
      setSmallWindowMessage('当前环境不支持画中画播放');
    }
  };

  const enterCourseFullscreen = async () => {
    const stage = playerStageRef.current as FullscreenContainer | null;
    const video = videoRef.current as PlayerVideoElement | null;
    if (!stage || !video) return;

    revealVideoActions();
    // Fullscreen the whole stage so the independently mirrored picture and
    // the unmirrored custom controls remain in the same layer.
    if (isFallbackFullscreen) {
      setIsFallbackFullscreen(false);
      try {
        screen.orientation?.unlock?.();
      } catch {
        // Orientation unlock is optional across Android WebViews.
      }
      return;
    }
    if (document.fullscreenElement === stage && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        // The browser keeps its own escape/close affordance if script-driven
        // exit is denied. Never turn an exit failure into a second fullscreen.
      }
      try {
        screen.orientation?.unlock?.();
      } catch {
        // Orientation unlock is optional across Android WebViews.
      }
      return;
    }
    const appleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    const mode = await enterCourseStageFullscreen(stage, appleMobile || isHuaweiHonorBrowser);
    if (mode === 'page') setIsFallbackFullscreen(true);
    const orientation = screen.orientation as ScreenOrientation & { lock?: (value: 'landscape') => Promise<void> };
    await orientation?.lock?.('landscape').catch(() => undefined);
  };

  const showRemotePlaybackMessage = useCallback((message: string, durationMs = 5200) => {
    setRemotePlaybackMessage(message);
    if (remoteMessageTimerRef.current !== null) window.clearTimeout(remoteMessageTimerRef.current);
    remoteMessageTimerRef.current = window.setTimeout(() => {
      setRemotePlaybackMessage('');
      remoteMessageTimerRef.current = null;
    }, durationMs);
  }, []);

  const startRemotePlayback = async () => {
    const video = videoRef.current as PlayerVideoElement | null;
    if (!video || (!video.webkitShowPlaybackTargetPicker && !video.remote?.prompt)) {
      showRemotePlaybackMessage(isAndroidBrowser
        ? ANDROID_SYSTEM_CAST_MESSAGE
        : '当前浏览器不支持网页内投屏，请使用系统投屏功能');
      return;
    }

    revealVideoActions();
    setRemotePlaybackMessage('');
    try {
      await openCourseCastPicker(video);
      setRemotePlaybackState(video.webkitCurrentPlaybackTargetIsWireless ? 'connected' : video.remote?.state || 'disconnected');
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'AbortError') return;
      if (name === 'NotSupportedError' && isAndroidBrowser) {
        // Some Android vendor browsers expose the API surface but cannot open
        // a receiver picker. Switch subsequent clicks to the system guide.
        setRemotePlaybackSupported(false);
      }
      showRemotePlaybackMessage(remotePlaybackErrorMessage(error, isAndroidBrowser));
    }
  };

  useEffect(() => {
    const video = videoRef.current as PlayerVideoElement | null;
    const remote = video?.remote;
    const supported = Boolean(videoUrl && (video?.webkitShowPlaybackTargetPicker || remote?.prompt));
    setRemotePlaybackSupported(supported);
    setRemotePlaybackAvailability('unknown');
    setRemotePlaybackState(remote?.state || 'disconnected');
    if (!supported || !video) return;
    const syncAirPlay = () => setRemotePlaybackState(video.webkitCurrentPlaybackTargetIsWireless ? 'connected' : remote?.state || 'disconnected');
    syncAirPlay();
    video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', syncAirPlay);

    let active = true;
    let availabilityCallbackId: number | undefined;
    const syncAvailability = (available: boolean) => {
      if (active) setRemotePlaybackAvailability(available ? 'available' : 'unavailable');
    };
    if (remote?.watchAvailability) {
      remote.watchAvailability(syncAvailability).then((callbackId) => {
        if (!active) {
          remote?.cancelWatchAvailability?.(callbackId).catch(() => undefined);
          return;
        }
        availabilityCallbackId = callbackId;
      }).catch((error) => {
        if (!active) return;
        const name = error instanceof DOMException ? error.name : '';
        // NotSupportedError means background discovery is unavailable;
        // prompt() can still scan after a direct user click.
        setRemotePlaybackAvailability(name === 'NotSupportedError' ? 'unknown' : 'unavailable');
      });
    }

    const handleConnecting = () => {
      setRemotePlaybackState('connecting');
      setRemotePlaybackMessage('正在连接投屏设备…');
    };
    const handleConnect = () => {
      setRemotePlaybackState('connected');
      showRemotePlaybackMessage('投屏已连接，可继续在手机上控制播放', 3200);
    };
    const handleDisconnect = () => {
      setRemotePlaybackState('disconnected');
      showRemotePlaybackMessage('投屏已断开', 2400);
    };
    remote?.addEventListener?.('connecting', handleConnecting as EventListener);
    remote?.addEventListener?.('connect', handleConnect as EventListener);
    remote?.addEventListener?.('disconnect', handleDisconnect as EventListener);
    return () => {
      active = false;
      video.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', syncAirPlay);
      if (availabilityCallbackId !== undefined) {
        remote?.cancelWatchAvailability?.(availabilityCallbackId).catch(() => undefined);
      }
      remote?.removeEventListener?.('connecting', handleConnecting as EventListener);
      remote?.removeEventListener?.('connect', handleConnect as EventListener);
      remote?.removeEventListener?.('disconnect', handleDisconnect as EventListener);
    };
  }, [showRemotePlaybackMessage, videoUrl, loading]);

  useEffect(() => {
    setShowVideoActions(false);
    setQualityMenuOpen(false);
    setSpeedMenuOpen(false);
    setRemotePlaybackMessage('');
    return () => {
      if (videoActionsTimerRef.current !== null) {
        window.clearTimeout(videoActionsTimerRef.current);
        videoActionsTimerRef.current = null;
      }
      if (remoteMessageTimerRef.current !== null) {
        window.clearTimeout(remoteMessageTimerRef.current);
        remoteMessageTimerRef.current = null;
      }
      if (gestureIndicatorTimerRef.current !== null) {
        window.clearTimeout(gestureIndicatorTimerRef.current);
        gestureIndicatorTimerRef.current = null;
      }
    };
  }, [videoUrl]);

  if (!course && platformCourseLoading) {
    return (
      <main className="min-h-screen bg-warm-white px-4 pt-28 text-center text-text-secondary">
        正在同步课程数据...
      </main>
    );
  }

  if (!course && platformSyncFailure) {
    return (
      <main className="min-h-screen bg-warm-white px-4 pt-24 text-[#2C1810]">
        <section
          className="mx-auto max-w-lg rounded-2xl border border-[#E8D5B5] bg-white p-6 text-center shadow-[0_18px_50px_rgba(44,24,16,0.08)]"
          role="alert"
          aria-live="assertive"
        >
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#FFF4E5] text-[#B66A16]">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-bold">{platformSyncFailure.title}</h1>
          <p className="mt-2 text-sm leading-6 text-[#6F6257]">{platformSyncFailure.message}</p>
          <div className="mt-4 rounded-xl bg-[#F8F4EC] px-4 py-3 text-left text-xs leading-5 text-[#76695E]">
            <p>错误编码：<span className="font-mono">{platformSyncFailure.code}</span></p>
            <p className="break-all">请求 ID：<span className="font-mono">{platformSyncFailure.requestId}</span></p>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={syncPlatformCourse}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#8F1D2C] px-5 text-sm font-bold text-white transition hover:bg-[#731724] focus:outline-none focus:ring-2 focus:ring-[#8F1D2C]/40"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              重新同步
            </button>
            <button
              type="button"
              onClick={copyPlatformSyncDiagnostics}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#D8C7AA] bg-white px-5 text-sm font-bold text-[#594A3D] transition hover:bg-[#FBF7F0] focus:outline-none focus:ring-2 focus:ring-[#D8C7AA]"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              {diagnosticsCopied ? '已复制排查信息' : '复制排查信息'}
            </button>
          </div>
          {diagnosticsCopyError && (
            <p className="mt-3 text-xs leading-5 text-[#9A4F16]" role="status">
              浏览器禁止访问剪贴板，请允许剪贴板权限后再试。
            </p>
          )}
        </section>
      </main>
    );
  }

  if (!course) {
    return (
      <main className="min-h-screen bg-warm-white px-4 pt-28 text-center">
        <h1 className="font-serif text-2xl font-bold text-text">课程不存在</h1>
        <Link href="/courses" className="mt-4 inline-flex text-gold-dark hover:text-crimson">返回课程列表</Link>
      </main>
    );
  }

  const handleLoginSuccess = (name: string) => {
    const { member } = syncStudentAuth();
    memberNameRef.current = name || member?.name || memberNameRef.current;
    const nextVideo = pendingVideo || activeVideo;
    setPendingVideo(null);
    setLoginOpen(false);
    if (!nextVideo) return;
    if (pendingScrollToPlayerRef.current) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      pendingScrollToPlayerRef.current = false;
    }
    setRequestedVideoId(String(nextVideo.id));
    setHasStartedPlayback(true);
    shouldAutoplayRef.current = true;
    setLoginReloadKey(value => value + 1);
    const nextHref = getCourseVideoHref({
      courseId,
      legacyCourseId: platformCourse?.legacyCourseId,
      platformSeriesId: learningSeriesId,
      videoId: nextVideo.id,
    });
    window.history.replaceState(window.history.state, '', nextHref);
  };
  const coverImage = String((course as any).image || staticCourse?.image || '/images/courses/placeholder-course.svg');

  return (
    <>
    <main
      className="course-video-page min-h-screen bg-[#F7F3EB] px-3 pb-8 pt-2 text-[#2C1810] md:px-7 md:pb-12 md:pt-3"
      data-history-swipe="ignore"
    >
      <div className="course-video-shell mx-auto max-w-7xl">
        {renderStudyToolbar('course-video-toolbar-desktop mb-4 hidden md:flex')}

        <section className="course-video-layout grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5">
          <div className="min-w-0 self-start">
            <div className="course-video-player-card overflow-hidden rounded-lg border border-[#E8DDCB] bg-[#140F0C] shadow-[0_12px_30px_rgba(44,24,16,0.14)] md:shadow-[0_18px_45px_rgba(44,24,16,0.18)]">
              {loading ? (
                <div className="grid aspect-video place-items-center text-white">
                  <Loader2 className="h-8 w-8 animate-spin text-[#C8A96E]" />
                </div>
              ) : videoUrl ? (
                <div
                  ref={playerStageRef}
                  className={`group relative bg-black ${isFallbackFullscreen ? 'course-video-fallback-fullscreen' : ''}`}
                  onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest('button, input')) return;
                    if (holdSpeedRef.current?.suppressClick()) return;
                    toggleVideoActions();
                  }}
                  onFocusCapture={(event) => {
                    if (event.target instanceof Element && event.target.closest('button, input')) revealVideoActions();
                  }}
                  onMouseLeave={() => setShowVideoActions(false)}
                >
                  {holdingSpeed && <div className="pointer-events-none absolute inset-x-0 top-14 z-20 text-center text-sm text-white" role="status">2 倍播放 · 松手恢复</div>}
                  {remotePlaybackMessage ? (
                    <div className="absolute left-2 right-2 top-16 z-20 rounded-lg bg-black/80 px-3 py-2 text-center text-xs font-semibold leading-5 text-white backdrop-blur" role="status" aria-live="polite">
                      {remotePlaybackMessage}
                    </div>
                  ) : null}
                  <div role="toolbar" aria-label="视频操作" className="absolute right-2 top-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-xl bg-black/70 px-1.5 py-1 text-white">
                      <button
                        type="button"
                        onClick={startRemotePlayback}
                        className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-white backdrop-blur transition ${remotePlaybackState === 'connected' ? 'bg-[#2F80ED]' : 'bg-black/60 hover:bg-black/75'}`}
                        aria-label={remotePlaybackState === 'connected'
                          ? '已连接投屏设备，点击管理投屏'
                          : remotePlaybackSupported
                            ? '搜索并连接投屏设备'
                            : '查看系统投屏方法'}
                        title={remotePlaybackAvailability === 'unavailable' ? '暂未发现设备，点击重新搜索' : '投屏'}
                      >
                        <Cast className="h-4 w-4" />
                        <span>{remotePlaybackState === 'connecting'
                          ? '连接中'
                          : remotePlaybackState === 'connected'
                            ? '已投屏'
                            : '投屏'}</span>
                      </button>
                    <div
                      className="relative"
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setQualityMenuOpen(false);
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSpeedMenuOpen(false);
                          if (qualityOptions.length > 1) setQualityMenuOpen(open => !open);
                        }}
                        className="inline-flex h-10 items-center gap-0.5 px-1 text-xs font-semibold text-white drop-shadow"
                        aria-label={`当前清晰度：${qualityLabel}，点击切换清晰度`}
                        aria-haspopup="menu"
                        aria-expanded={qualityMenuOpen}
                      >
                        <span>{qualityLabel}</span>
                        {qualityOptions.length > 1 ? <ChevronDown className={`h-3.5 w-3.5 transition ${qualityMenuOpen ? 'rotate-180' : ''}`} /> : null}
                      </button>
                      {qualityMenuOpen && qualityOptions.length > 1 ? (
                        <div className="absolute right-0 top-full z-30 mt-1 min-w-24 overflow-hidden rounded-lg border border-white/15 bg-black/85 py-1 text-white shadow-xl backdrop-blur" role="menu" aria-label="切换视频清晰度">
                          {qualityOptions.map((option) => {
                            const active = option.value === selectedQuality;
                            return (
                              <button
                                key={`${option.value}-${option.url}`}
                                type="button"
                                role="menuitemradio"
                                aria-checked={active}
                                onClick={() => changeQuality(option.value)}
                                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-semibold transition hover:bg-white/15 ${active ? 'text-[#F2C66D]' : 'text-white'}`}
                              >
                                <span>{option.label}</span>
                                {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                    <div
                      className="relative"
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setSpeedMenuOpen(false);
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setQualityMenuOpen(false);
                          setSpeedMenuOpen(open => !open);
                        }}
                        className="inline-flex h-10 items-center gap-0.5 px-1 text-xs font-semibold text-white drop-shadow"
                        aria-label={`当前播放速度：${playbackRate}倍，点击调整`}
                        aria-haspopup="menu"
                        aria-expanded={speedMenuOpen}
                      >
                        <span>{playbackRate}×</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition ${speedMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {speedMenuOpen ? (
                        <div className="absolute right-0 top-full z-30 mt-1 min-w-24 overflow-hidden rounded-lg border border-white/15 bg-black/85 py-1 text-white shadow-xl backdrop-blur" role="menu" aria-label="调整播放速度">
                          {PLAYBACK_RATE_OPTIONS.map((rate) => {
                            const active = rate === playbackRate;
                            return (
                              <button
                                key={rate}
                                type="button"
                                role="menuitemradio"
                                aria-checked={active}
                                onClick={() => changePlaybackRate(rate)}
                                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-semibold transition hover:bg-white/15 ${active ? 'text-[#F2C66D]' : 'text-white'}`}
                              >
                                <span>{rate}×</span>
                                {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={toggleMirrorPlayback}
                      className={`inline-flex h-10 items-center justify-center rounded-full px-2.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/75 ${isMirrored ? 'bg-[#2F80ED]/90' : 'bg-black/60'}`}
                      aria-label={isMirrored ? '当前为镜面播放，点击切换为正面' : '当前为正面播放，点击切换为镜面'}
                      aria-pressed={isMirrored}
                      title={isMirrored ? '镜面播放' : '正面播放'}
                    >
                      {isMirrored ? '镜面' : '正面'}
                    </button>
                    <button
                      type="button"
                      onClick={toggleSmallWindow}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/75"
                      aria-label={smallWindowMessage || '画中画播放'}
                    >
                      <PictureInPicture2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={enterCourseFullscreen}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/75"
                      aria-label={isCourseFullscreen ? '退出全屏播放' : '横屏全屏播放'}
                    >
                      {isCourseFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </button>
                  </div>
                  {gestureIndicator ? (
                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                      {gestureIndicator.side === 'volume' ? <Volume2 className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                      <span>{Math.round(gestureIndicator.value * 100)}%</span>
                    </div>
                  ) : null}
                  {lessonEnded ? (
                    <div className="course-video-autoplay-prompt absolute left-1/2 top-1/2 z-20 w-[min(90%,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-black/75 px-4 py-3 text-center text-white shadow-2xl backdrop-blur" role="status" aria-live="polite">
                      <p className="text-sm font-semibold">{autoplayCountdown ? `${autoplayCountdown.seconds} 秒后播放下一节：${displayName(autoplayCountdown.target.name)}` : '本节课程已播放完成'}</p>
                      <div className="mt-2 flex items-center justify-center gap-3">
                        <button type="button" onClick={replayLesson} className="min-h-10 rounded-full bg-[#9F1D20] px-5 text-xs font-semibold text-white">重播</button>
                        {autoplayCountdown && <button type="button" onClick={lessonCompletion.cancel} className="min-h-10 rounded-full border border-white/30 bg-white/10 px-3 text-xs font-semibold text-white">取消连播</button>}
                      </div>
                    </div>
                  ) : null}
                  <div className={`course-video-section-controls absolute bottom-12 left-2 right-2 z-10 flex items-center justify-between gap-2 transition-opacity duration-200 md:left-3 md:right-3 ${showVideoActions || autoplayCountdown ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
                    <div className="flex items-center gap-1 rounded-full bg-black/60 p-1 text-white shadow-lg backdrop-blur">
                      <button
                        type="button"
                        disabled={!previousVideo}
                        onClick={() => previousVideo && selectVideo(previousVideo)}
                        className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label="播放上一节"
                      >
                        <SkipBack className="h-4 w-4 fill-current" />
                        <span className="hidden sm:inline">上一节</span>
                      </button>
                      <button
                        type="button"
                        disabled={!nextVideo}
                        onClick={() => nextVideo && selectVideo(nextVideo)}
                        className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label="播放下一节"
                      >
                        <SkipForward className="h-4 w-4 fill-current" />
                        <span className="hidden sm:inline">下一节</span>
                      </button>
                    </div>
                  </div>
                  <div
                    className={`course-video-transport-controls absolute bottom-1 left-2 right-2 z-20 flex h-10 items-center gap-2 rounded-lg bg-black/70 px-2 text-white shadow-lg backdrop-blur transition-opacity duration-200 md:left-3 md:right-3 ${showVideoActions || autoplayCountdown ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
                    aria-label="视频播放控制"
                  >
                    <button
                      type="button"
                      onClick={togglePlayback}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-white/15"
                      aria-label={isVideoPlaying ? '暂停播放' : '继续播放'}
                    >
                      {isVideoPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                    </button>
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-white/90">
                      {formatDuration(currentSeconds)} / {formatDuration(duration)}
                    </span>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(1, duration)}
                      step="0.1"
                      value={Math.min(currentSeconds, Math.max(1, duration))}
                      onChange={(event) => seekPlayback(Number(event.currentTarget.value))}
                      className="course-video-progress min-w-0 flex-1"
                      aria-label="播放进度"
                      aria-valuetext={`${formatDuration(currentSeconds)} / ${formatDuration(duration)}`}
                    />
                    <button
                      type="button"
                      onClick={togglePlaybackMuted}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-white/15"
                      aria-label={isVideoMuted ? '恢复声音' : '静音'}
                    >
                      {isVideoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                  </div>
                  <AdaptiveCourseVideo
                    key={videoUrl}
                    data-playback-instance={videoUrl}
                    videoRef={videoRef}
                    src={videoUrl}
                    controls={false}
                    autoPlay={hasStartedPlayback}
                    preload="auto"
                    playsInline
                    x-webkit-airplay="allow"
                    disableRemotePlayback={false}
                    muted={false}
                    className={`block aspect-video w-full bg-black ${isMirrored ? 'course-video-mirrored' : ''}`}
                    style={{
                      WebkitTouchCallout: 'none',
                      userSelect: 'none',
                      filter: `brightness(${videoBrightness})`,
                      touchAction: isCourseFullscreen ? 'none' : 'pan-y pinch-zoom',
                      transform: isMirrored ? 'scaleX(-1)' : undefined,
                    }}
                    onPointerDown={startPlaybackGesture}
                    onPointerMove={updatePlaybackGesture}
                    onPointerUp={endPlaybackGesture}
                    onPointerCancel={endPlaybackGesture}
                    onPointerLeave={endPlaybackGesture}
                    onContextMenu={(event) => event.preventDefault()}
                    onError={() => holdSpeedRef.current?.end()}
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      video.muted = false;
                      video.defaultMuted = false;
                      video.volume = 1;
                      holdSpeedRef.current?.end();
                      video.defaultPlaybackRate = playbackRate;
                      video.playbackRate = playbackRate;
                      const total = Math.floor(video.duration || playInfo?.duration || duration || 0);
                      if (total > 0) setDuration(total);
                      const pendingSwitch = pendingQualitySwitchRef.current;
                      if (pendingSwitch) {
                        const targetSeconds = total > 0
                          ? Math.min(pendingSwitch.seconds, Math.max(0, total - 1))
                          : pendingSwitch.seconds;
                        if (targetSeconds > 0) video.currentTime = targetSeconds;
                        setCurrentSeconds(targetSeconds);
                        pendingQualitySwitchRef.current = null;
                        if (pendingSwitch.shouldPlay) video.play().catch(() => undefined);
                        return;
                      }
                      if (!restoredRef.current && resumeSeconds > 3 && resumeSeconds < total - 5) {
                        video.currentTime = resumeSeconds;
                        restoredRef.current = true;
                      }
                      playFromCatalog(video);
                    }}
                    onCanPlay={(event) => {
                      event.currentTarget.defaultPlaybackRate = playbackRate;
                      event.currentTarget.playbackRate = holdingSpeed ? 2 : playbackRate;
                      playFromCatalog(event.currentTarget);
                    }}
                    onSeeking={(event) => {
                      const video = event.currentTarget;
                      if (!video.paused && !video.ended) resumeAfterSeekRef.current = true;
                    }}
                    onSeeked={(event) => resumePlaybackAfterSeek(event.currentTarget)}
                    onPlay={() => {
                      setIsVideoPlaying(true);
                      lessonCompletion.reset();
                    }}
                    onTimeUpdate={(event) => setCurrentSeconds(Math.floor(event.currentTarget.currentTime || 0))}
                    onPause={(event) => {
                      holdSpeedRef.current?.end();
                      setIsVideoPlaying(false);
                      saveProgress(false, false, {
                        videoId: activeVideoId,
                        currentTime: event.currentTarget.currentTime,
                        duration: event.currentTarget.duration,
                      }).catch(() => undefined);
                    }}
                    onVolumeChange={(event) => setIsVideoMuted(event.currentTarget.muted || event.currentTarget.volume === 0)}
                    onEnded={(event) => {
                      holdSpeedRef.current?.end();
                      setIsVideoPlaying(false);
                      handlePlaybackEnded(event.currentTarget, activeVideoId);
                    }}
                  />
                </div>
              ) : (
                <div
                  className="relative grid aspect-video place-items-center overflow-hidden bg-cover bg-center px-6 text-center text-white"
                  style={{ backgroundImage: `url(${coverImage})` }}
                >
                  <div className="absolute inset-0 bg-[#140F0C]/55 backdrop-blur-[1px]" />
                  <div className="relative z-10">
                    <PlayCircle className="mx-auto mb-3 h-10 w-10 text-[#C8A96E]" />
                    {error === AUTH_CONTACT_TEXT ? (
                      <button
                        type="button"
                        onClick={() => setShowAuthorizationContact(true)}
                        className="course-video-auth-button rounded-full bg-white/12 px-5 py-2 text-lg font-bold text-white underline-offset-4 transition hover:bg-white/20 hover:underline md:text-xl"
                      >
                        点击申请授权
                      </button>
                    ) : (
                      <p className="font-semibold">{error || (hasStartedPlayback ? '暂无可播放视频' : '点击下方目录')}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-white p-3 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2 md:gap-3">
                  <div className="min-w-0">
                    <h1 className="course-video-title font-serif text-lg font-bold leading-snug text-[#2C1810] md:text-2xl md:leading-tight">{activeChapter?.name || displayName(activeVideo?.name || course.title)}</h1>
                    <p className="course-video-description mt-1 line-clamp-2 text-xs leading-5 text-[#8C8172] md:mt-2 md:text-sm md:leading-6">{course.description}</p>
                  </div>
                </div>
              </div>
            </div>
            {renderStudyToolbar('mt-2.5 md:hidden')}

          </div>

          <aside className="course-video-sidebar space-y-3 md:space-y-4">
            <div className="rounded-lg border border-[#E8DDCB] bg-white shadow-sm">
              <div className="grid grid-cols-3 border-b border-[#E8DDCB] text-sm font-bold">
                {[
                  ['catalog', ListVideo, `目录(${chapters.length}节)`],
                  ['notes', MessageSquareText, '笔记'],
                  ['intro', FileText, '简介'],
                ].map(([key, Icon, label]) => {
                  const TabIcon = Icon as typeof ListVideo;
                  return (
                    <button
                      key={String(key)}
                      type="button"
                      onClick={() => setActivePanel(key as ActivePanel)}
                      className={`course-video-tab flex min-h-11 items-center justify-center gap-2 px-1 py-2 transition md:min-h-12 ${activePanel === key ? 'bg-[#8B1A1A] text-white' : 'text-[#8C8172] hover:bg-[#F7F3EB] hover:text-[#8B1A1A]'}`}
                    >
                      <TabIcon className="h-4 w-4 shrink-0" />
                      <span>{String(label)}</span>
                    </button>
                  );
                })}
              </div>

              <div className="p-2.5 md:p-3">
                {activePanel === 'catalog' ? (
                  <div className="space-y-2 md:space-y-3">
                    {renderCatalogPagination()}
                    <div className="space-y-2 md:space-y-3">
                    {paginatedCatalogEntries.map(({ chapter, chapterIndex, selectedVideo, catalogTitle }) => {
                      const videos = chapter.videos || [];
                      const primaryVideo = selectedVideo || videos[0];
                      const active = (chapter.videos || []).some(video => String(video.id) === activeVideoId);
                      const percent = videoProgressPercent(primaryVideo);
                      const progressRow = primaryVideo?.id ? progressByVideo.get(String(primaryVideo.id)) : undefined;
                      const videoDuration = Math.max(
                        Number(primaryVideo?.duration || 0),
                        Number(progressRow?.duration || 0),
                        primaryVideo && String(primaryVideo.id) === activeVideoId ? Number(duration || playInfo?.duration || 0) : 0,
                      );

                      return (
                        <button
                          key={chapter.id}
                          type="button"
                          aria-current={active ? 'true' : undefined}
                          disabled={!primaryVideo}
                          onClick={() => primaryVideo && selectVideo(primaryVideo, { scrollToPlayer: true })}
                          className={`course-video-catalog-row grid w-full grid-cols-[auto,minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-[#E8DDCB] bg-[#FFFDF8] px-2.5 py-2.5 text-left transition md:px-3 md:py-3 ${active ? 'border-[#2F80ED] bg-[#F7EEDB] text-[#8B1A1A]' : 'hover:border-[#C8A96E] hover:bg-[#F7F3EB]'} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <BookOpen className="mt-0.5 h-4 w-4 text-[#A98746]" />
                          <span className="course-video-catalog-title min-w-0 whitespace-normal break-words text-sm font-semibold leading-5">{chapterIndex + 1}. {catalogTitle}</span>
                          <span className="mt-0.5 flex min-w-[42px] flex-col items-end gap-0.5 text-right">
                            <span className="course-video-catalog-meta text-[11px] font-semibold leading-4 text-[#8C8172]">{videoDuration > 0 ? formatDuration(videoDuration) : '--:--'}</span>
                            <span className="course-video-catalog-meta text-xs font-bold leading-4 text-[#A98746]">{percent}%</span>
                          </span>
                        </button>
                      );
                    })}
                    {catalogEntries.length === 0 && normalizeCatalogSearch(catalogQuery) ? (
                      <div className="rounded-md border border-dashed border-[#D9C9B2] bg-[#FFFDF8] px-4 py-8 text-center">
                        <Search className="mx-auto mb-2 h-5 w-5 text-[#A98746]" />
                        <p className="text-sm font-semibold text-[#5F5145]">没有找到“{catalogQuery.trim()}”相关课节</p>
                        <button
                          type="button"
                          onClick={() => updateCatalogQuery('')}
                          className="mt-3 rounded-full border border-[#D9C9B2] bg-white px-3 py-1 text-xs font-bold text-[#8B1A1A]"
                        >
                          清除搜索
                        </button>
                      </div>
                    ) : null}
                    </div>
                    {renderCatalogPagination()}
                  </div>
                ) : null}

                {activePanel === 'notes' ? (
                  <div className="space-y-2.5">
                    {notes.length ? notes.map(note => (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => seekTo(Number(note.timestamp_seconds || 0))}
                        className="w-full rounded-md border border-[#E8DDCB] bg-[#FFFDF8] px-3 py-2 text-left hover:border-[#C8A96E]"
                      >
                        <span className="text-xs font-bold text-[#A98746]">
                          {formatDuration(note.timestamp_seconds)}
                          {' · '}
                          {noteAuthor(note, memberNameRef.current || '学员')}
                          {formatNoteCreatedAt(note.created_at) ? ` · ${formatNoteCreatedAt(note.created_at)}` : ''}
                        </span>
                        <p className="mt-1 text-sm leading-5 text-[#2C1810]">{note.content}</p>
                      </button>
                    )) : <p className="rounded-md bg-[#FFFDF8] px-3 py-2 text-sm text-[#8C8172]">暂无笔记</p>}

                    <div className="rounded-md border border-[#E8DDCB] bg-[#FFFDF8] p-2.5">
                      <div className="mb-2 flex items-center gap-2">
                        <StickyNote className="h-4 w-4 text-[#A98746]" />
                        <h2 className="text-sm font-bold text-[#2C1810]">课程笔记</h2>
                      </div>
                      <textarea
                        value={noteContent}
                        onChange={(event) => setNoteContent(event.target.value)}
                        placeholder="记录当前视频时间点的练习要点..."
                        rows={2}
                        className="min-h-0 w-full resize-none rounded-md border border-[#E8DDCB] bg-white px-3 py-2 text-sm leading-5 outline-none transition focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/20"
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          disabled={savingNote || !noteContent.trim()}
                          onClick={addNote}
                          className="h-8 rounded-md bg-[#8B1A1A] px-4 text-xs font-bold text-white transition hover:bg-[#6E1414] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingNote ? '保存中' : '保存笔记'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activePanel === 'intro' ? (
                  <div className="space-y-4 text-sm leading-7 text-[#5F5145]">
                    <div>
                      <h3 className="mb-2 font-serif text-lg font-bold text-[#2C1810]">{course.title}</h3>
                      <p>{course.fullDescription || course.description}</p>
                    </div>
                    {knowledge?.outcomes?.length ? (
                      <div>
                        <h4 className="mb-2 font-bold text-[#8B1A1A]">学习收获</h4>
                        <ul className="space-y-2">
                          {knowledge.outcomes.slice(0, 6).map(item => (
                            <li key={item} className="flex gap-2">
                              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#A98746]" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
    <StudentLoginModal
      open={loginOpen}
      onClose={() => {
        setLoginOpen(false);
        setPendingVideo(null);
        pendingScrollToPlayerRef.current = false;
      }}
      onSuccess={handleLoginSuccess}
    />
    {showAuthorizationContact && renderAuthorizationContact()}
    </>
  );
}
