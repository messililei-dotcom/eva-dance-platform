'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import { Table } from '@/components/adaptive-table';
import type { UploadProps } from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PictureOutlined,
  PlusOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UploadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import writeXlsxFile, { type SheetData } from 'write-excel-file/browser';
import { platformAdapter } from '@/lib/adapters/platform';
import { trainingApi } from '@/lib/api';
import { formatPaymentAmount, formatPrice } from '@/lib/money-format';
import { compareTableValues, sortableColumns } from '@/lib/table-sort';
import type { Member } from '@/types/domain';

const { Text, Title } = Typography;
const INTERNATIONAL_PHONE_PATTERN = /^\+?[0-9\s()-]{6,24}$/;

type CourseRow = {
  id: number;
  name: string;
  type: string;
  series_id?: number;
  seriesId?: number;
  subType?: string;
  startDate?: string;
  endDate?: string;
  price: number;
  sessions: number;
  validDays?: number;
  teacher?: string;
  content?: string;
  studentCount?: number;
  totalAmount?: number;
  attendanceSheetPath?: string;
  attendanceSheetFilename?: string;
  attendanceSheetUploadedAt?: string;
  coverImage?: string;
};

function isOfflineTrainingCourse(course: CourseRow) {
  return Number(course.series_id ?? course.seriesId ?? 0) <= 0;
}

type PaymentRow = {
  id: number;
  memberId: number;
  memberName: string;
  memberPhone: string;
  courseId: number;
  courseName: string;
  courseSubType?: string;
  amount: number;
  date: string;
  payment: string;
  sales?: string;
  remark?: string;
  expireDate?: string;
  remainingSessions: number;
  voucherPath?: string;
  voucherFilename?: string;
  voucherUploadedAt?: string;
  created_at?: string;
};

type PaymentVoucherState = {
  voucherPath: string;
  voucherFilename: string;
  voucherUploadedAt: string;
  file?: File;
  date?: string;
  memberName?: string;
  courseName?: string;
};

type ConsumeRow = {
  id: number;
  memberId: number;
  memberName: string;
  memberPhone: string;
  paymentId: number;
  courseId: number;
  courseName: string;
  courseSubType?: string;
  count: number;
  consumeDate: string;
  remainingAfter: number;
  operator?: string;
  remark?: string;
};

type CourseStudent = {
  key: string;
  memberId: number;
  memberName: string;
  memberPhone: string;
  paymentCount: number;
  totalAmount: number;
  expireDate?: string;
  remainingSessions: number;
  lastPaymentId: number;
};

type CourseCertificateStudent = CourseStudent & {
  certificateId?: number;
  certificateNo?: string;
  issueDate?: string;
  pdfUrl?: string;
  verifyUrl?: string;
  issued: boolean;
};

type CourseCertificateSummary = {
  total: number;
  issued: number;
  pending: number;
};

const courseTypes = ['集训', '次卡', '年卡', '传承弟子'];
const paymentMethods = ['微信', '支付宝', '现金', '刷卡', '转账'];
const consumableTypes = new Set(['集训', '次卡']);

function money(value: number) {
  return formatPaymentAmount(value);
}

function dateText(value?: string) {
  return value ? String(value).slice(0, 10) : '-';
}

function apiError(err: any) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || '操作失败';
}

function memberLabel(member: Member) {
  return `${member.name} ${member.phone ? `(${member.phone})` : ''}`;
}

function courseLabel(course?: CourseRow | null) {
  if (!course) return '';
  return `${course.name}${course.subType ? ` / ${course.subType}` : ''}`;
}

function trainingCourseCoverSource(coverImage?: string, courseName?: string, allowNameFallback = false) {
  const source = String(coverImage || '').trim();
  if (source.startsWith('data:') || source.startsWith('blob:') || /^https?:\/\//i.test(source)) return source;
  if (!source && (!allowNameFallback || !courseName)) return '';
  const params = new URLSearchParams();
  if (source) params.set('src', source);
  if (courseName) params.set('name', courseName);
  return `/api/courses/cover-image?${params.toString()}`;
}

function maskPhone(phone?: string) {
  return String(phone || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

function readFileAsSheet(file: File) {
  return new Promise<any>((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('签到表照片仅支持图片文件'));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('签到表照片不能超过 12MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: reader.result });
    reader.onerror = () => reject(new Error('读取签到表照片失败'));
    reader.readAsDataURL(file);
  });
}

export default function TrainingPage() {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [consumeRecords, setConsumeRecords] = useState<ConsumeRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [regions, setRegions] = useState<Array<{ province: string; cities: string[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('courses');
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [consumeModalOpen, setConsumeModalOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [batchConsumeOpen, setBatchConsumeOpen] = useState(false);
  const [certificateModalOpen, setCertificateModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseRow | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [editingConsume, setEditingConsume] = useState<ConsumeRow | null>(null);
  const [detailCourse, setDetailCourse] = useState<CourseRow | null>(null);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedAddMemberIds, setSelectedAddMemberIds] = useState<number[]>([]);
  const [batchCourseId, setBatchCourseId] = useState<number | undefined>();
  const [selectedBatchPaymentIds, setSelectedBatchPaymentIds] = useState<number[]>([]);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [certificateStudents, setCertificateStudents] = useState<CourseCertificateStudent[]>([]);
  const [certificateSummary, setCertificateSummary] = useState<CourseCertificateSummary>({ total: 0, issued: 0, pending: 0 });
  const [selectedCertificateMemberIds, setSelectedCertificateMemberIds] = useState<number[]>([]);
  const [paymentMemberSearch, setPaymentMemberSearch] = useState('');
  const [paymentCourseSearch, setPaymentCourseSearch] = useState('');
  const [paymentVoucher, setPaymentVoucher] = useState<PaymentVoucherState | null>(null);
  const paymentVoucherInputRef = useRef<HTMLInputElement | null>(null);
  const [batchForm] = Form.useForm();
  const [memberForm] = Form.useForm();
  const [courseForm] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [consumeForm] = Form.useForm();
  const courseCoverImage = Form.useWatch('coverImage', courseForm);
  const memberCountry = Form.useWatch('country', memberForm);
  const memberProvince = Form.useWatch('province', memberForm);
  const consumeMemberId = Form.useWatch('memberId', consumeForm);

  const load = () => {
    setLoading(true);
    return trainingApi.getCourses()
      .then(courseRows => {
        const offlineCourses = courseRows.filter(isOfflineTrainingCourse);
        setCourses(offlineCourses);
        setLoading(false);
        return Promise.all([
      trainingApi.getPayments(),
      trainingApi.getConsumeRecords(),
          platformAdapter.getMemberDirectory().catch(() => ({ members: [], orderRevenue: 0 })),
      platformAdapter.getRegions().catch(() => []),
        ]).then(([paymentRows, consumeRows, memberDirectory, regionRows]) => {
        const courseMap = new Map(offlineCourses.map(course => [String(course.id), course]));
        setPayments(paymentRows.map(payment => ({
          ...payment,
          courseSubType: payment.courseSubType || courseMap.get(String(payment.courseId))?.subType || '',
        })));
        setConsumeRecords(consumeRows);
          setMembers(memberDirectory.members);
        setRegions(regionRows);
        });
      })
      .catch(err => message.error(apiError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const chinaRegions = useMemo(() => regions.filter(item => item.province !== '海外'), [regions]);
  const overseasCountries = useMemo(() => regions.find(item => item.province === '海外')?.cities || [], [regions]);
  const memberCityOptions = useMemo(() => chinaRegions.find(item => item.province === memberProvince)?.cities || [], [chinaRegions, memberProvince]);

  useEffect(() => {
    const syncTabFromUrl = () => {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab && ['courses', 'payments', 'consume'].includes(tab)) setActiveTab(tab);
      else setActiveTab('courses');
    };
    syncTabFromUrl();
    const handleTopFeatureChange = (event: Event) => {
      const key = (event as CustomEvent<string>).detail || '';
      if (!key.startsWith('/training')) return;
      const tab = new URLSearchParams(key.split('?')[1] || '').get('tab');
      if (tab && ['courses', 'payments', 'consume'].includes(tab)) setActiveTab(tab);
      else setActiveTab('courses');
    };
    window.addEventListener('popstate', syncTabFromUrl);
    window.addEventListener('admin-top-feature-change', handleTopFeatureChange);
    return () => {
      window.removeEventListener('popstate', syncTabFromUrl);
      window.removeEventListener('admin-top-feature-change', handleTopFeatureChange);
    };
  }, []);

  const courseStatsById = useMemo(() => {
    const stats = new Map<number, { studentCount: number; totalAmount: number }>();
    courses.forEach(course => {
      const coursePayments = payments.filter(payment => Number(payment.courseId) === Number(course.id));
      stats.set(course.id, {
        studentCount: new Set(coursePayments.map(payment => String(payment.memberId || payment.memberPhone || payment.memberName))).size,
        totalAmount: coursePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      });
    });
    return stats;
  }, [courses, payments]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(courses.map(item => item.type).filter(Boolean)))], [courses]);
  const filteredCourses = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return courses.filter(item => {
      const matchKeyword = !q || [item.name, item.teacher, item.type, item.subType].some(value => String(value || '').toLowerCase().includes(q));
      const matchCategory = category === 'all' || item.type === category;
      return matchKeyword && matchCategory;
    });
  }, [courses, keyword, category]);
  const filteredPayments = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return payments.filter(item => !q || [item.memberName, item.memberPhone, item.courseName, item.payment, item.sales, item.remark].some(value => String(value || '').toLowerCase().includes(q)));
  }, [payments, keyword]);
  const filteredConsumes = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return consumeRecords.filter(item => !q || [item.memberName, item.memberPhone, item.courseName, item.operator, item.remark].some(value => String(value || '').toLowerCase().includes(q)));
  }, [consumeRecords, keyword]);

  const consumedByPayment = useMemo(() => {
    const map = new Map<number, number>();
    consumeRecords.forEach(c => {
      const pid = Number(c.paymentId || 0);
      if (pid) map.set(pid, (map.get(pid) || 0) + Number(c.count || 0));
    });
    return map;
  }, [consumeRecords]);

  const consumablePayments = useMemo(() => payments
    .filter(item => Number(item.remainingSessions || 0) > 0 || editingConsume?.paymentId === item.id), [payments, editingConsume]);

  const consumeMemberOptions = useMemo(() => {
    const grouped = new Map<string, { value: number | string; label: string; searchText: string }>();
    consumablePayments.forEach(item => {
      const value = item.memberId || item.memberPhone || item.memberName;
      if (!value) return;
      const key = String(value);
      if (grouped.has(key)) return;
      const label = `${item.memberName || '未命名学员'}${item.memberPhone ? ` / ${item.memberPhone}` : ''}`;
      grouped.set(key, { value, label, searchText: `${label} ${item.courseName || ''}` });
    });
    return Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
  }, [consumablePayments]);

  const paymentOptions = useMemo(() => consumablePayments
    .filter(item => !consumeMemberId || String(item.memberId || item.memberPhone || item.memberName) === String(consumeMemberId))
    .map(item => ({
      value: item.id,
      label: `${item.courseName || '未命名课程'}${item.courseSubType ? ` / ${item.courseSubType}` : ''} / 剩余 ${item.remainingSessions || 0} 次`,
      row: item,
    })), [consumablePayments, consumeMemberId]);

  const buildCourseStudents = (course: CourseRow): CourseStudent[] => {
    const grouped = new Map<string, CourseStudent>();
    payments.filter(payment => Number(payment.courseId) === Number(course.id)).forEach(payment => {
      const key = String(payment.memberId || payment.memberPhone || payment.memberName || payment.id);
      const member = members.find(item => String(item.id) === String(payment.memberId));
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, {
          key,
          memberId: Number(payment.memberId),
          memberName: member?.name || payment.memberName || '-',
          memberPhone: member?.phone || payment.memberPhone || '-',
          paymentCount: 1,
          totalAmount: Number(payment.amount || 0),
          expireDate: payment.expireDate || course.endDate || '',
          remainingSessions: Number(payment.remainingSessions || 0),
          lastPaymentId: payment.id,
        });
        return;
      }
      current.paymentCount += 1;
      current.totalAmount += Number(payment.amount || 0);
      if (Number(payment.remainingSessions || 0) >= Number(current.remainingSessions || 0)) {
        current.remainingSessions = Number(payment.remainingSessions || 0);
        current.lastPaymentId = payment.id;
      }
      if (payment.expireDate && (!current.expireDate || payment.expireDate > current.expireDate)) current.expireDate = payment.expireDate;
    });
    return Array.from(grouped.values()).sort((a, b) => String(a.memberName).localeCompare(String(b.memberName), 'zh-CN'));
  };

  const detailStudents = useMemo<CourseStudent[]>(() => {
    if (!detailCourse) return [];
    return buildCourseStudents(detailCourse);
  }, [detailCourse, payments, members]);

  const addableMembers = useMemo(() => {
    if (!detailCourse) return [];
    const existingIds = new Set(payments.filter(payment => Number(payment.courseId) === Number(detailCourse.id)).map(payment => String(payment.memberId)));
    const q = memberSearch.trim().toLowerCase();
    return members.filter(member => {
      if (existingIds.has(String(member.id))) return false;
      const text = `${member.name || ''} ${member.phone || ''}`.toLowerCase();
      return !q || text.includes(q);
    });
  }, [detailCourse, payments, members, memberSearch]);

  const batchCourse = useMemo(() => courses.find(item => Number(item.id) === Number(batchCourseId)), [courses, batchCourseId]);
  const batchStudents = useMemo(() => {
    if (!batchCourseId) return [];
    const grouped = new Map<string, PaymentRow>();
    payments
      .filter(payment => Number(payment.courseId) === Number(batchCourseId) && Number(payment.remainingSessions || 0) > 0)
      .forEach(payment => {
        const key = String(payment.memberId || payment.memberPhone || payment.memberName || payment.id);
        const existing = grouped.get(key);
        if (!existing || Number(payment.remainingSessions || 0) > Number(existing.remainingSessions || 0)) grouped.set(key, payment);
      });
    return Array.from(grouped.values());
  }, [payments, batchCourseId]);

  const nowMonth = dayjs().format('YYYY-MM');
  const monthConsumed = consumeRecords.filter(record => String(record.consumeDate).startsWith(nowMonth)).reduce((sum, record) => sum + Number(record.count || 0), 0);

  const exportToExcel = async (data: any[], fileName: string, columns: { key: string; title: string }[]) => {
    try {
      const rows: SheetData = [
        columns.map(col => ({ value: col.title, type: String, fontWeight: 'bold' as const })),
        ...data.map(row => columns.map(col => ({ value: String(row[col.key] ?? ''), type: String }))),
      ];
      await writeXlsxFile(rows).toFile(`${fileName}_${dayjs().format('YYYYMMDD')}.xlsx`);
      message.success('导出成功');
    } catch (err: any) {
      message.error(err?.message || '导出失败');
    }
  };

  const openCourseModal = (record?: CourseRow | null) => {
    setEditingCourse(record || null);
    courseForm.setFieldsValue(record ? {
      ...record,
      startDate: record.startDate ? dayjs(record.startDate) : undefined,
      endDate: record.endDate ? dayjs(record.endDate) : undefined,
    } : { type: '集训', sessions: 10, price: 0, validDays: 365, startDate: dayjs(), endDate: dayjs() });
    setCourseModalOpen(true);
  };

  const openCourseCreateFromSearch = (searchText: string) => {
    const name = searchText.trim();
    setEditingCourse(null);
    courseForm.setFieldsValue({
      name,
      type: '集训',
      sessions: 10,
      price: 0,
      validDays: 365,
      startDate: dayjs(),
      endDate: dayjs(),
    });
    setCourseModalOpen(true);
  };

  const openPaymentCourseDetail = (payment: PaymentRow) => {
    const course = courses.find(item => Number(item.id) === Number(payment.courseId))
      || courses.find(item => item.name === payment.courseName && (!payment.courseSubType || item.subType === payment.courseSubType))
      || null;
    if (!course) {
      message.warning('未找到对应课程详情');
      return;
    }
    setDetailCourse(course);
  };

  const openMemberModal = (searchText = '') => {
    const keyword = searchText.trim();
    const looksLikePhone = /^1[3-9]\d{0,9}$/.test(keyword);
    memberForm.resetFields();
    memberForm.setFieldsValue({
      name: looksLikePhone ? '' : keyword,
      phone: looksLikePhone ? keyword : '',
      gender: '女',
      level: '普通学员',
      country: '中国',
      province: undefined,
      city: undefined,
      foreignRegion: undefined,
      address: '',
      register_date: dayjs(),
    });
    setMemberModalOpen(true);
  };

  const openPaymentModal = (record?: PaymentRow) => {
    setEditingPayment(record || null);
    setPaymentMemberSearch('');
    setPaymentCourseSearch('');
    setPaymentVoucher(record?.voucherPath ? {
      voucherPath: record.voucherPath,
      voucherFilename: record.voucherFilename || record.voucherPath.split('/').pop() || '付款凭证',
      voucherUploadedAt: record.voucherUploadedAt || '',
    } : null);
    if (paymentVoucherInputRef.current) paymentVoucherInputRef.current.value = '';
    paymentForm.setFieldsValue(record ? {
      ...record,
      date: record.date ? dayjs(record.date) : dayjs(),
    } : { date: dayjs(), payment: '微信', amount: 0 });
    setPaymentModalOpen(true);
  };

  const currentPaymentVoucherContext = (values: any = paymentForm.getFieldsValue()) => {
    const member = members.find(item => String(item.id) === String(values.memberId));
    const course = courses.find(item => String(item.id) === String(values.courseId));
    const date = values.date ? dayjs(values.date).format('YYYY-MM-DD') : '';
    return { member, course, date };
  };

  const uploadPaymentVoucherFile = async (file: File, oldPath = '') => {
    const { member, course, date } = currentPaymentVoucherContext();
    if (!date || !member?.name || !course?.name) throw new Error('请先选择缴费日期、学员和课程');
    if (!file.type.startsWith('image/')) throw new Error('付款凭证仅支持图片文件');
    if (file.size > 12 * 1024 * 1024) throw new Error('付款凭证图片不能超过 12MB');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('date', date);
    formData.append('memberName', member.name);
    formData.append('courseName', course.name);
    if (oldPath) formData.append('oldPath', oldPath);

    const res = await trainingApi.uploadPaymentVoucher(formData);
    const data = res?.data || {};
    const nextVoucher: PaymentVoucherState = {
      voucherPath: data.voucherPath,
      voucherFilename: data.voucherFilename,
      voucherUploadedAt: data.voucherUploadedAt,
      file,
      date,
      memberName: member.name,
      courseName: course.name,
    };
    setPaymentVoucher(nextVoucher);
    return nextVoucher;
  };

  const handlePaymentVoucherChange = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    try {
      const pendingOldPath = paymentVoucher?.voucherPath && paymentVoucher.voucherPath !== editingPayment?.voucherPath ? paymentVoucher.voucherPath : '';
      await uploadPaymentVoucherFile(file, pendingOldPath);
      message.success('付款凭证已上传');
    } catch (err) {
      message.error(apiError(err));
    } finally {
      if (paymentVoucherInputRef.current) paymentVoucherInputRef.current.value = '';
      setSaving(false);
    }
  };

  const openConsumeModal = (record?: Partial<ConsumeRow>) => {
    setEditingConsume(record?.id ? record as ConsumeRow : null);
    const payment = record?.paymentId ? payments.find(item => String(item.id) === String(record.paymentId)) : undefined;
    consumeForm.resetFields();
    consumeForm.setFieldsValue(record ? {
      ...record,
      memberId: payment?.memberId || record.memberId || payment?.memberPhone || payment?.memberName,
      paymentId: payment?.id || record.paymentId,
      consumeDate: record.consumeDate ? dayjs(record.consumeDate) : dayjs(),
    } : { consumeDate: dayjs(), count: 1 });
    setConsumeModalOpen(true);
  };

  const openAddMembers = () => {
    setSelectedAddMemberIds([]);
    setMemberSearch('');
    setAddMembersOpen(true);
  };

  const openBatchConsume = (course?: CourseRow | null) => {
    const defaultCourse = course || detailCourse || undefined;
    setBatchCourseId(defaultCourse?.id);
    setSelectedBatchPaymentIds([]);
    batchForm.setFieldsValue({ count: 1, consumeDate: dayjs() });
    setBatchConsumeOpen(true);
  };

  const normalizeCertificateStudent = (row: any): CourseCertificateStudent => ({
    key: String(row.memberId || row.member_id || row.memberPhone || row.member_phone || row.certificateId || row.certificate_id),
    memberId: Number(row.memberId || row.member_id || 0),
    memberName: row.memberName || row.member_name || '-',
    memberPhone: row.memberPhone || row.member_phone || '',
    paymentCount: Number(row.paymentCount || row.payment_count || 0),
    totalAmount: Number(row.totalAmount || row.total_amount || 0),
    expireDate: row.expireDate || row.expire_date || '',
    remainingSessions: Number(row.remainingSessions || row.remaining_sessions || 0),
    lastPaymentId: Number(row.lastPaymentId || row.last_payment_id || 0),
    certificateId: Number(row.certificateId || row.certificate_id || 0),
    certificateNo: row.certificateNo || row.certificate_no || '',
    issueDate: row.issueDate || row.issue_date || '',
    pdfUrl: row.pdfUrl || row.pdf_url || '',
    verifyUrl: row.verifyUrl || row.verify_url || '',
    issued: Boolean(row.issued || row.certificateId || row.certificate_id),
  });

  const loadCourseCertificateStatus = async (course: CourseRow, selectPending = false) => {
    setCertificateLoading(true);
    try {
      const res = await trainingApi.getCourseCertificates(course.id);
      const data = res?.data || {};
      const rows: CourseCertificateStudent[] = Array.isArray(data.students) ? data.students.map(normalizeCertificateStudent) : [];
      setCertificateStudents(rows);
      setCertificateSummary({
        total: Number(data.summary?.total ?? rows.length),
        issued: Number(data.summary?.issued ?? rows.filter(row => row.issued).length),
        pending: Number(data.summary?.pending ?? rows.filter(row => !row.issued).length),
      });
      if (selectPending) {
        setSelectedCertificateMemberIds(rows.filter(row => !row.issued).map(row => row.memberId));
      }
    } catch (err) {
      message.error(apiError(err));
      setCertificateStudents([]);
      setCertificateSummary({ total: 0, issued: 0, pending: 0 });
    } finally {
      setCertificateLoading(false);
    }
  };

  const openCertificateIssue = async (course?: CourseRow | null) => {
    const targetCourse = course || detailCourse;
    if (!targetCourse) return;
    setCertificateModalOpen(true);
    setSelectedCertificateMemberIds([]);
    await loadCourseCertificateStatus(targetCourse, true);
  };

  const saveCourse = async () => {
    const values = await courseForm.validateFields();
    setSaving(true);
    try {
      const payload = {
        ...values,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : '',
        endDate: values.endDate ? values.endDate.format('YYYY-MM-DD') : '',
      };
      if (editingCourse) await trainingApi.updateCourse(editingCourse.id, payload);
      else await trainingApi.createCourse(payload);
      message.success(editingCourse ? '课程已更新' : '课程已新建');
      setCourseModalOpen(false);
      load();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const saveMember = async () => {
    const values = await memberForm.validateFields();
    setSaving(true);
    try {
      await platformAdapter.createMember({
        name: values.name.trim(),
        phone: values.phone.trim(),
        gender: values.gender,
        birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : '',
        level: values.level || '普通学员',
        register_date: values.register_date ? values.register_date.format('YYYY-MM-DD') : '',
        country: values.country || '中国',
        province: values.country === '中国' ? values.province || '' : '',
        city: values.country === '中国' ? values.city || '' : '',
        foreignRegion: values.country === '中国' ? '' : values.foreignRegion || values.country || '',
        address: values.address || '',
        remark: values.remark || '',
      });
      const memberRows = await platformAdapter.getMembers().catch(() => []);
      setMembers(memberRows);
      message.success('学员已新建');
      setMemberModalOpen(false);
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async () => {
    const values = await paymentForm.validateFields();
    const member = members.find(item => String(item.id) === String(values.memberId));
    const course = courses.find(item => String(item.id) === String(values.courseId));
    setSaving(true);
    try {
      let voucher = paymentVoucher;
      if (paymentVoucher?.file) {
        const date = values.date ? values.date.format('YYYY-MM-DD') : '';
        if (paymentVoucher.date !== date || paymentVoucher.memberName !== member?.name || paymentVoucher.courseName !== course?.name) {
          voucher = await uploadPaymentVoucherFile(
            paymentVoucher.file,
            paymentVoucher.voucherPath && paymentVoucher.voucherPath !== editingPayment?.voucherPath ? paymentVoucher.voucherPath : '',
          );
        }
      }
      const payload = {
        ...values,
        memberName: member?.name,
        memberPhone: member?.phone,
        courseName: course?.name,
        date: values.date ? values.date.format('YYYY-MM-DD') : '',
        remainingSessions: values.remainingSessions ?? course?.sessions ?? 0,
        voucherPath: voucher?.voucherPath || '',
        voucherFilename: voucher?.voucherFilename || '',
        voucherUploadedAt: voucher?.voucherUploadedAt || '',
        previousVoucherPath: editingPayment?.voucherPath && editingPayment.voucherPath !== voucher?.voucherPath ? editingPayment.voucherPath : '',
      };
      if (editingPayment) await trainingApi.updatePayment(editingPayment.id, payload);
      else await trainingApi.createPayment(payload);
      message.success(editingPayment ? '缴费记录已更新' : '缴费记录已新建');
      setPaymentModalOpen(false);
      load();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const saveConsume = async () => {
    const values = await consumeForm.validateFields();
    const payment = payments.find(item => String(item.id) === String(values.paymentId));
    if (!editingConsume?.id && !payment) {
      message.error('请先选择学员和可核销课程');
      return;
    }
    setSaving(true);
    try {
      if (editingConsume?.id) {
        await trainingApi.updateConsumeRecord(editingConsume.id, {
          count: values.count,
          consumeDate: values.consumeDate ? values.consumeDate.format('YYYY-MM-DD') : '',
          operator: editingConsume.operator,
          remark: values.remark || '',
        });
      } else {
        await trainingApi.createConsumeRecord({
          memberId: payment?.memberId,
          memberName: payment?.memberName,
          memberPhone: payment?.memberPhone,
          paymentId: payment?.id,
          courseId: payment?.courseId,
          courseName: payment?.courseName,
          count: values.count,
          consumeDate: values.consumeDate ? values.consumeDate.format('YYYY-MM-DD') : '',
          remark: values.remark || '',
        });
      }
      message.success(editingConsume ? '核销记录已更新' : '核销成功');
      setConsumeModalOpen(false);
      load();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmAddMembers = async () => {
    if (!detailCourse || !selectedAddMemberIds.length) return;
    setSaving(true);
    try {
      for (const memberId of selectedAddMemberIds) {
        const member = members.find(item => Number(item.id) === Number(memberId));
        if (!member) continue;
        await trainingApi.createPayment({
          memberId: member.id,
          memberName: member.name,
          memberPhone: member.phone,
          courseId: detailCourse.id,
          courseName: detailCourse.name,
          amount: 0,
          date: dayjs().format('YYYY-MM-DD'),
          payment: '',
          sales: detailCourse.teacher || '',
          remark: '课程添加学员',
          remainingSessions: detailCourse.sessions || 0,
        });
      }
      message.success(`已添加 ${selectedAddMemberIds.length} 名学员`);
      setAddMembersOpen(false);
      setSelectedAddMemberIds([]);
      load();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const removeCourseStudent = async (record: CourseStudent) => {
    if (!detailCourse) return;
    const paymentIds = payments
      .filter(payment => Number(payment.memberId) === Number(record.memberId) && Number(payment.courseId) === Number(detailCourse.id))
      .map(payment => payment.id);

    setSaving(true);
    try {
      for (const id of paymentIds) await trainingApi.deletePayment(id);
      message.success('已移除');
      await load();
    } catch (err) {
      message.error(apiError(err));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const executeBatchConsume = async () => {
    const values = await batchForm.validateFields();
    if (!batchCourse || !selectedBatchPaymentIds.length) {
      message.error(!batchCourse ? '请选择课程' : '请至少选择一名学员');
      return;
    }
    setSaving(true);
    let success = 0;
    let failed = 0;
    try {
      for (const paymentId of selectedBatchPaymentIds) {
        const payment = payments.find(item => Number(item.id) === Number(paymentId));
        if (!payment) continue;
        try {
          await trainingApi.createConsumeRecord({
            memberId: payment.memberId,
            memberName: payment.memberName,
            memberPhone: payment.memberPhone,
            paymentId: payment.id,
            courseId: batchCourse.id,
            courseName: batchCourse.name,
            count: values.count,
            consumeDate: values.consumeDate ? values.consumeDate.format('YYYY-MM-DD') : '',
            remark: '批量核销',
          });
          success += 1;
        } catch {
          failed += 1;
        }
      }
      message[success ? 'success' : 'error'](`批量核销完成，成功 ${success} 人${failed ? `，失败 ${failed} 人` : ''}`);
      setBatchConsumeOpen(false);
      setSelectedBatchPaymentIds([]);
      load();
    } finally {
      setSaving(false);
    }
  };

  const issueSelectedCertificates = async () => {
    if (!detailCourse) return;
    if (!selectedCertificateMemberIds.length) {
      message.error('请至少选择一名未发证学员');
      return;
    }
    setSaving(true);
    try {
      const res = await trainingApi.issueCourseCertificates(detailCourse.id, { memberIds: selectedCertificateMemberIds });
      const data = res?.data || {};
      message.success(`证书发放完成，新增 ${data.issued || 0} 张${data.skipped ? `，跳过已发 ${data.skipped} 人` : ''}`);
      setSelectedCertificateMemberIds([]);
      await loadCourseCertificateStatus(detailCourse);
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadAttendanceSheet: UploadProps['beforeUpload'] = async (file) => {
    if (!editingCourse) {
      message.error('请先保存课程，再上传签到表照片');
      return Upload.LIST_IGNORE;
    }
    setSaving(true);
    try {
      const sheet = await readFileAsSheet(file);
      await trainingApi.uploadAttendanceSheet(editingCourse.id, sheet);
      message.success('签到表照片已上传');
      load();
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
    return Upload.LIST_IGNORE;
  };

  const uploadCourseCover: UploadProps['beforeUpload'] = async (file) => {
    if (!file.type.startsWith('image/')) {
      message.error('课程主图仅支持图片文件');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 12 * 1024 * 1024) {
      message.error('课程主图不能超过 12MB');
      return Upload.LIST_IGNORE;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('courseName', courseForm.getFieldValue('name') || editingCourse?.name || '线下课程');
      formData.append('oldCoverImage', courseForm.getFieldValue('coverImage') || editingCourse?.coverImage || '');
      const res = await trainingApi.uploadCourseCover(formData);
      const coverImage = res?.data?.coverImage || res?.coverImage || '';
      if (!coverImage) throw new Error('上传课程主图失败');
      courseForm.setFieldValue('coverImage', coverImage);
      message.success('课程主图已上传');
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
    return Upload.LIST_IGNORE;
  };

  const uploadDetailCourseCover: UploadProps['beforeUpload'] = async (file) => {
    if (!detailCourse) return Upload.LIST_IGNORE;
    if (!file.type.startsWith('image/')) {
      message.error('课程主图仅支持图片文件');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 12 * 1024 * 1024) {
      message.error('课程主图不能超过 12MB');
      return Upload.LIST_IGNORE;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('courseName', detailCourse.name || '线下课程');
      formData.append('oldCoverImage', detailCourse.coverImage || '');
      const res = await trainingApi.uploadCourseCover(formData);
      const coverImage = res?.data?.coverImage || res?.coverImage || '';
      if (!coverImage) throw new Error('上传课程主图失败');

      const nextCourse = { ...detailCourse, coverImage };
      await trainingApi.updateCourse(detailCourse.id, nextCourse);
      setDetailCourse(nextCourse);
      setCourses(prev => prev.map(course => Number(course.id) === Number(detailCourse.id) ? nextCourse : course));
      message.success('课程主图已更新');
    } catch (err) {
      message.error(apiError(err));
    } finally {
      setSaving(false);
    }
    return Upload.LIST_IGNORE;
  };

  const printAttendanceSheet = (course: CourseRow, students?: CourseStudent[]) => {
    const rows = students || buildCourseStudents(course);
    const html = `
      <html><head><title>${course.name} 签到表</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px;color:#111}
        h1{text-align:center;font-size:22px;margin:0 0 18px}
        .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;font-size:13px}
        .meta div{border:1px solid #ddd;padding:8px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ccc;padding:8px;text-align:left;height:28px}
        th{background:#f5f5f5}
      </style></head><body>
        <h1>伊娃东方舞课程签到表</h1>
        <div class="meta">
          <div>课程名称：${course.name || ''}</div><div>课程类型：${course.type || ''}${course.subType ? ` / ${course.subType}` : ''}</div>
          <div>课程顾问：${course.teacher || ''}</div><div>打印日期：${dayjs().format('YYYY-MM-DD')}</div>
          <div>上课日期：</div><div>上课次间：</div><div>课次：${course.sessions || ''}</div><div>应到人数：${rows.length}</div>
        </div>
        <table><thead><tr><th>序号</th><th>姓名</th><th>手机号</th><th>剩余</th><th>签到核销</th><th>签名</th><th>备注</th></tr></thead>
        <tbody>${Array.from({ length: Math.max(rows.length, 18) }, (_, index) => {
          const student = rows[index];
          return `<tr><td>${index + 1}</td><td>${student?.memberName || ''}</td><td>${student ? maskPhone(student.memberPhone) : ''}</td><td>${student?.remainingSessions ?? ''}</td><td></td><td></td><td></td></tr>`;
        }).join('')}</tbody></table>
      </body></html>`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return message.error('浏览器阻止了打印窗口');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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

  const renderTabButton = (key: string, label: string, count: number, color: string, softColor: string) => {
    const selected = activeTab === key;
    return (
      <span
        className="training-tab-button"
        style={{
          background: selected ? color : softColor,
          borderColor: selected ? color : 'transparent',
          color: selected ? '#fff' : color,
          boxShadow: selected ? `0 10px 24px ${color}33` : 'none',
        }}
      >
        <span>{label}</span>
        <span
          className="training-tab-count"
          style={{
            background: selected ? 'rgba(255,255,255,0.22)' : '#fff',
            color: selected ? '#fff' : color,
          }}
        >
          {count}
        </span>
      </span>
    );
  };

  return (
    <div>
      <div className="page-header">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={2}>线下课程</Title>
            <Text className="training-page-subtitle" type="secondary">同步原学员管理系统课程、学员添加、缴费、核销与签到表流程。</Text>
          </Col>
          <Col>
            <Space wrap>
              <Button className="payment-action-button" icon={<PlusOutlined />} onClick={() => openPaymentModal()}>新建缴费</Button>
              <Button icon={<PlusOutlined />} onClick={() => openCourseModal()}>新建课程</Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => openConsumeModal()}>新建核销</Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Card className="training-filter-card" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={12}>
            <Input prefix={<SearchOutlined />} placeholder="搜索课程、学员、手机号、课程顾问、备注" value={keyword} onChange={event => setKeyword(event.target.value)} allowClear />
          </Col>
          <Col className="training-mobile-hidden-filter" xs={24} md={6}>
            <Select value={category} onChange={setCategory} style={{ width: '100%' }} options={categories.map(item => ({ value: item, label: item === 'all' ? '全部课程类型' : item }))} />
          </Col>
          <Col className="training-mobile-hidden-filter" xs={24} md={6}><Text type="secondary">本月核销：<Text strong>{monthConsumed}</Text> 次</Text></Col>
        </Row>
      </Card>

      <Tabs
        className="training-tabs"
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          const nextPath = `/training?tab=${key}`;
          router.replace(nextPath);
          window.dispatchEvent(new CustomEvent('admin-top-feature-change', { detail: nextPath }));
        }}
        items={[
          {
            key: 'payments',
            label: renderTabButton('payments', '缴费', filteredPayments.length, '#22C55E', '#ECFDF3'),
            children: (
              <Card className="training-payments-card" styles={{ body: { padding: 0 } }} extra={
                <Space>
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => exportToExcel(filteredPayments, '缴费记录', [
                    { key: 'memberName', title: '姓名' }, { key: 'memberPhone', title: '手机号' }, { key: 'courseName', title: '课程' },
                    { key: 'courseSubType', title: '课程期次' },
                    { key: 'date', title: '缴费日期' }, { key: 'amount', title: '金额' }, { key: 'payment', title: '支付方式' },
                    { key: 'sales', title: '课程顾问' }, { key: 'remainingSessions', title: '剩余课次' }, { key: 'remark', title: '备注' },
                  ])}>导出Excel</Button>
                  {selectedPaymentIds.length > 0 && (
                    <Tooltip title={`删除选中 ${selectedPaymentIds.length} 条缴费记录`}>
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label={`删除选中 ${selectedPaymentIds.length} 条缴费记录`} onClick={() => confirmDelete(`确定批量删除选中的 ${selectedPaymentIds.length} 条缴费记录吗？`, async () => {
                        for (const id of selectedPaymentIds) await trainingApi.deletePayment(id);
                        setSelectedPaymentIds([]);
                      })}>批量删除</Button>
                    </Tooltip>
                  )}
                </Space>
              }>
                <Table<PaymentRow>
                  className="training-payments-table"
                  rowKey="id"
                  size="middle"
                  dataSource={filteredPayments}
                  rowSelection={{ selectedRowKeys: selectedPaymentIds, onChange: (keys) => setSelectedPaymentIds(keys as number[]) }}
                  scroll={{ x: 1600 }}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  locale={{ emptyText: <Empty description="暂无缴费记录" /> }}
                  columns={sortableColumns<PaymentRow>([
                    { title: '手机号', dataIndex: 'memberPhone', fixed: 'left', width: 120 },
                    { title: '姓名', dataIndex: 'memberName', fixed: 'left', width: 100, render: value => <Text strong>{value}</Text> },
                    {
                      title: '课程',
                      dataIndex: 'courseName',
                      width: 200,
                      className: 'course-name-column',
                      render: (value, record) => (
                        <Button
                          type="link"
                          size="small"
                          className="table-cell-link-button"
                          onClick={() => openPaymentCourseDetail(record)}
                          title="查看课程详情"
                        >
                          {value || '-'}
                        </Button>
                      ),
                    },
                    { title: '课程期次', dataIndex: 'courseSubType', width: 120, render: value => value || '-' },
                    { title: '缴费日期', dataIndex: 'date', width: 110, render: dateText },
                    { title: '金额', dataIndex: 'amount', align: 'right' as const, width: 110, render: value => <Text strong style={{ color: '#F72A8A' }}>{money(value)}</Text> },
                    { title: '支付方式', dataIndex: 'payment', width: 90, render: value => value || '-' },
                    { title: '课程顾问', dataIndex: 'sales', width: 100, render: value => value || '-' },
                    { title: '剩余课次', dataIndex: 'remainingSessions', align: 'right' as const, width: 90, render: value => <Tag color={value > 0 ? 'green' : 'default'}>{value || 0}</Tag> },
                    { title: '已核销', align: 'right' as const, width: 80, sorter: (a, b) => compareTableValues(consumedByPayment.get(a.id) || 0, consumedByPayment.get(b.id) || 0), render: (_, record) => consumedByPayment.get(record.id) || 0 },
                    { title: '提交时间', dataIndex: 'created_at', width: 160, render: value => value ? String(value).slice(0, 16) : '-' },
                    { title: '备注', dataIndex: 'remark', ellipsis: true, width: 120 },
                    {
                      title: '凭证',
                      dataIndex: 'voucherPath',
                      width: 90,
                      render: (value, record) => value ? (
                        <a href={value} target="_blank" rel="noreferrer" title={record.voucherFilename || '查看付款凭证'}>
                          查看
                        </a>
                      ) : <Text type="secondary">未提交</Text>,
                    },
	                    {
	                      title: '操作',
	                      fixed: 'right',
	                      width: 126,
	                      render: (_, record) => (
	                        <Space size={4}>
	                          <Button size="small" onClick={() => openConsumeModal({ paymentId: record.id })}>核销</Button>
	                          <Button size="small" icon={<EditOutlined />} title="编辑" aria-label="编辑" onClick={() => openPaymentModal(record)} />
	                          <Button size="small" danger icon={<DeleteOutlined />} title="删除" aria-label="删除" onClick={() => confirmDelete('确定删除此缴费记录吗？关联核销也会删除。', () => trainingApi.deletePayment(record.id))} />
                        </Space>
                      ),
                    },
                  ])}
                />
              </Card>
            ),
          },
          {
            key: 'courses',
            label: renderTabButton('courses', '课程', filteredCourses.length, '#F72A8A', '#FFF0F7'),
            children: (
              <Card styles={{ body: { padding: 0 } }} extra={<Button icon={<DownloadOutlined />} onClick={() => exportToExcel(filteredCourses.map(course => ({ ...course, ...courseStatsById.get(course.id) })), '课程数据', [
                { key: 'name', title: '课程名称' }, { key: 'type', title: '课程类型' }, { key: 'subType', title: '课程期次' },
                { key: 'startDate', title: '开始日期' }, { key: 'endDate', title: '结束日期' }, { key: 'price', title: '价格' },
                { key: 'sessions', title: '课次数' }, { key: 'studentCount', title: '学员数' }, { key: 'totalAmount', title: '累计费用' },
              ])}>导出</Button>}>
                <Table<CourseRow>
                  rowKey="id"
                  size="middle"
                  dataSource={filteredCourses}
                  scroll={{ x: 1460 }}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  locale={{ emptyText: <Empty description="暂无课程数据" /> }}
                  onRow={(record) => ({ onClick: () => setDetailCourse(record), style: { cursor: 'pointer' } })}
                  columns={[
                    {
                      title: '课程名称',
                      dataIndex: 'name',
                      fixed: 'left',
                      width: 280,
                      align: 'left' as const,
                      className: 'course-name-column',
                      render: (value, record) => (
                        <Space size={10} align="center" onClick={event => event.stopPropagation()}>
                          <div style={{ width: 42, height: 42, borderRadius: 6, overflow: 'hidden', border: '1px solid #edf0f6', background: '#f7efff', color: '#C026D3', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                            {trainingCourseCoverSource(record.coverImage, record.name, true) ? <img src={trainingCourseCoverSource(record.coverImage, record.name, true)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <PictureOutlined style={{ fontSize: 20 }} />}
                          </div>
                          <a onClick={() => setDetailCourse(record)} style={{ minWidth: 0 }}>
                            <Text strong className="training-course-name-wrap">{value}</Text>
                          </a>
                        </Space>
                      ),
                    },
                    { title: '类型', dataIndex: 'type', width: 100, render: value => <Tag color="magenta">{value}</Tag> },
                    { title: '课程期次', dataIndex: 'subType', width: 130, render: value => value || '-' },
                    { title: '开始日期', dataIndex: 'startDate', width: 120, render: dateText },
                    { title: '结束日期', dataIndex: 'endDate', width: 120, render: dateText },
                    { title: '价格', dataIndex: 'price', align: 'right' as const, width: 110, render: value => formatPrice(value) },
                    { title: '课次', dataIndex: 'sessions', align: 'right' as const, width: 80 },
                    { title: '授课教师', dataIndex: 'teacher', width: 110, render: value => value || '-' },
                    { title: '学员数', align: 'right' as const, width: 90, render: (_, record) => courseStatsById.get(record.id)?.studentCount || 0 },
                    { title: '累计费用', align: 'right' as const, width: 120, render: (_, record) => money(courseStatsById.get(record.id)?.totalAmount || 0) },
                    { title: '签到表', width: 90, render: (_, record) => record.attendanceSheetPath ? <a href={record.attendanceSheetPath} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>查看</a> : '-' },
                    {
                      title: '操作',
                      fixed: 'right',
                      width: 260,
                      render: (_, record) => (
                        <Space onClick={event => event.stopPropagation()}>
                          <Tooltip title="详情">
                            <Button size="small" icon={<EyeOutlined />} aria-label="详情" onClick={() => setDetailCourse(record)} />
                          </Tooltip>
                          <Tooltip title="编辑">
                            <Button size="small" icon={<EditOutlined />} aria-label="编辑" onClick={() => openCourseModal(record)} />
                          </Tooltip>
                          {consumableTypes.has(record.type) && <Button size="small" className="plain-batch-button" onClick={() => openBatchConsume(record)}>批量核销</Button>}
                          <Button size="small" danger icon={<DeleteOutlined />} title="删除" aria-label="删除" onClick={() => confirmDelete('确定删除此课程吗？已有缴费或核销记录的课程将由原系统阻止删除。', () => trainingApi.deleteCourse(record.id))} />
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'consume',
            label: renderTabButton('consume', '核销记录', filteredConsumes.length, '#7C3AED', '#F3EFFF'),
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<ConsumeRow>
                  rowKey="id"
                  size="middle"
                  dataSource={filteredConsumes}
                  scroll={{ x: 1220 }}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  locale={{ emptyText: <Empty description="暂无核销记录" /> }}
                  columns={sortableColumns<ConsumeRow>([
                    { title: '手机号', dataIndex: 'memberPhone', fixed: 'left', width: 130 },
                    { title: '姓名', dataIndex: 'memberName', fixed: 'left', width: 110, render: value => <Text strong>{value}</Text> },
                    { title: '课程名称', dataIndex: 'courseName', width: 240, className: 'course-name-column' },
                    { title: '核销日期', dataIndex: 'consumeDate', width: 120, render: dateText },
                    { title: '核销次数', dataIndex: 'count', align: 'right' as const, width: 100 },
                    { title: '剩余课次', dataIndex: 'remainingAfter', align: 'right' as const, width: 100, render: value => <Tag color={value > 0 ? 'green' : 'default'}>{value || 0}</Tag> },
                    { title: '操作人', dataIndex: 'operator', width: 110 },
                    { title: '备注', dataIndex: 'remark', ellipsis: true },
                    {
                      title: '操作',
                      fixed: 'right',
                      width: 150,
                      render: (_, record) => (
                        <Space>
                          <Button size="small" icon={<EditOutlined />} onClick={() => openConsumeModal(record)}>编辑</Button>
                          <Button size="small" danger icon={<DeleteOutlined />} title="删除" aria-label="删除" onClick={() => confirmDelete('确定删除此核销记录吗？课次会自动恢复。', () => trainingApi.deleteConsumeRecord(record.id))} />
                        </Space>
                      ),
                    },
                  ])}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal title={detailCourse ? `${detailCourse.name} - 课程详情` : ''} open={!!detailCourse} onCancel={() => setDetailCourse(null)} footer={null} width={980} destroyOnClose>
        {detailCourse && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap>
              <Button type="primary" icon={<EditOutlined />} onClick={() => { setDetailCourse(null); openCourseModal(detailCourse); }}>编辑课程</Button>
              <Button icon={<UserAddOutlined />} onClick={openAddMembers}>添加学员</Button>
              {consumableTypes.has(detailCourse.type) && <Button className="plain-batch-button" icon={<CheckCircleOutlined />} onClick={() => openBatchConsume(detailCourse)}>批量核销</Button>}
              <Button icon={<SafetyCertificateOutlined />} onClick={() => openCertificateIssue(detailCourse)}>发放证书</Button>
              <Button icon={<PrinterOutlined />} onClick={() => printAttendanceSheet(detailCourse)}>打印签到表</Button>
              {detailCourse.attendanceSheetPath && <Button href={detailCourse.attendanceSheetPath} target="_blank">查看已签签到表</Button>}
            </Space>
            <Row gutter={16} align="top">
              <Col flex="180px">
                <Upload showUploadList={false} beforeUpload={uploadDetailCourseCover} accept="image/*">
                  <div
                    title="点击上传更换课程主图"
                    style={{ width: 180, height: 135, borderRadius: 8, overflow: 'hidden', border: '1px solid #edf0f6', background: '#f7efff', color: '#C026D3', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                  >
                    {trainingCourseCoverSource(detailCourse.coverImage, detailCourse.name, true) ? (
                      <img src={trainingCourseCoverSource(detailCourse.coverImage, detailCourse.name, true)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Space direction="vertical" size={4} align="center">
                        <PictureOutlined style={{ fontSize: 42 }} />
                        <Text type="secondary">点击上传</Text>
                      </Space>
                    )}
                  </div>
                </Upload>
              </Col>
              <Col flex="auto" style={{ minWidth: 0 }}>
                <Descriptions bordered size="small" column={{ xs: 1, md: 3 }}>
                  <Descriptions.Item label="课程名称">{detailCourse.name}</Descriptions.Item>
                  <Descriptions.Item label="课程类型"><Tag color="magenta">{detailCourse.type}</Tag></Descriptions.Item>
                  <Descriptions.Item label="课程期次">{detailCourse.subType || '-'}</Descriptions.Item>
                  <Descriptions.Item label="课程顾问">{detailCourse.teacher || '-'}</Descriptions.Item>
                  <Descriptions.Item label="价格">{formatPrice(detailCourse.price)}</Descriptions.Item>
                  <Descriptions.Item label="课次数">{detailCourse.sessions || '-'}</Descriptions.Item>
                  <Descriptions.Item label="有效期">{detailCourse.validDays ? `${detailCourse.validDays} 天` : '-'}</Descriptions.Item>
                  <Descriptions.Item label="总学员数">{detailStudents.length} 人</Descriptions.Item>
                  <Descriptions.Item label="课程收入">{money(detailStudents.reduce((sum, student) => sum + student.totalAmount, 0))}</Descriptions.Item>
                  <Descriptions.Item label="开始日期">{dateText(detailCourse.startDate)}</Descriptions.Item>
                  <Descriptions.Item label="结束日期">{dateText(detailCourse.endDate)}</Descriptions.Item>
                  <Descriptions.Item label="课程描述" span={3}>{detailCourse.content || '-'}</Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
            <Card title={`学员列表 (${detailStudents.length}人)`} styles={{ body: { padding: 0 } }}>
              <Table<CourseStudent>
                scroll={{ x: 'max-content' }}
                rowKey="key"
                size="small"
                dataSource={detailStudents}
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: <Empty description="暂无学员" /> }}
                columns={sortableColumns<CourseStudent>([
                  { title: '手机号', dataIndex: 'memberPhone', width: 130 },
                  { title: '姓名', dataIndex: 'memberName', width: 120, render: value => <Text strong>{value}</Text> },
                  { title: '缴费次数', dataIndex: 'paymentCount', align: 'right' as const, width: 100, render: value => <Tag color={value > 1 ? 'orange' : 'blue'}>{value}次</Tag> },
                  { title: '累计金额', dataIndex: 'totalAmount', align: 'right' as const, width: 120, render: money },
                  { title: '到期日期', dataIndex: 'expireDate', width: 120, render: dateText },
                  { title: '剩余课次', dataIndex: 'remainingSessions', align: 'right' as const, width: 100, render: value => <Tag color={value > 0 ? 'green' : 'default'}>{value || 0}</Tag> },
                  {
                    title: '操作',
                    width: 140,
                    render: (_, record) => (
                      <Space size={8}>
                        {record.remainingSessions > 0 ? (
                          <Button size="small" onClick={() => openConsumeModal({ paymentId: record.lastPaymentId, count: 1, consumeDate: dayjs().format('YYYY-MM-DD') } as Partial<ConsumeRow>)}>核销</Button>
                        ) : (
                          <Text type="secondary">-</Text>
                        )}
                        {detailCourse && (
                          <Popconfirm
                            title="确定将该学员从课程中移除吗？相关缴费和核销记录也会删除。"
                            okText="移除"
                            okButtonProps={{ danger: true }}
                            cancelText="取消"
                            onConfirm={() => removeCourseStudent(record)}
                          >
                            <Button size="small" danger>移除</Button>
                          </Popconfirm>
                        )}
                      </Space>
                    ),
                  },
                ])}
              />
            </Card>
          </Space>
        )}
      </Modal>

      <Modal
        className="training-payment-modal training-compact-modal training-course-modal"
        title={editingCourse ? '编辑课程' : '新建课程'}
        open={courseModalOpen}
        onCancel={() => setCourseModalOpen(false)}
        onOk={saveCourse}
        confirmLoading={saving}
        width={820}
        destroyOnClose
        footer={(_, { OkBtn, CancelBtn }) => (
          <Space wrap>
            {editingCourse && consumableTypes.has(editingCourse.type) && <Button className="plain-batch-button" icon={<CheckCircleOutlined />} onClick={() => openBatchConsume(editingCourse)}>批量核销</Button>}
            {editingCourse && <Button icon={<PrinterOutlined />} onClick={() => printAttendanceSheet(editingCourse, detailStudents)}>预览签到表</Button>}
            {editingCourse && <Upload showUploadList={false} beforeUpload={uploadAttendanceSheet}><Button icon={<UploadOutlined />} loading={saving}>上传签到表</Button></Upload>}
            <CancelBtn />
            <OkBtn />
          </Space>
        )}
      >
        <Form form={courseForm} layout="vertical">
          <Row className="payment-modal-grid" gutter={[8, 0]}>
            <Col className="payment-field-equal" xs={12} md={12}><Form.Item name="name" label="课程名称" rules={[{ required: true, message: '请输入课程名称' }]}><Input /></Form.Item></Col>
            <Col className="payment-field-equal" xs={12} md={12}><Form.Item name="type" label="课程类型" rules={[{ required: true }]}><Select options={courseTypes.map(value => ({ value, label: value }))} /></Form.Item></Col>
            <Col className="training-course-cover-field" xs={24} md={8}>
              <Form.Item label="课程主图">
                <Upload showUploadList={false} beforeUpload={uploadCourseCover} accept="image/*">
                  <div
                    className="training-course-cover-upload"
                    style={{
                      width: 180,
                      height: 135,
                      border: '1px dashed #d9d9d9',
                      borderRadius: 8,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                      background: '#fafafa',
                      color: '#8c8c8c',
                    }}
                  >
                    {courseCoverImage ? (
                      <img src={trainingCourseCoverSource(courseCoverImage, courseForm.getFieldValue('name') || editingCourse?.name)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Space direction="vertical" size={4} align="center">
                        <PictureOutlined style={{ fontSize: 28 }} />
                        <Text type="secondary">点击上传</Text>
                      </Space>
                    )}
                  </div>
                </Upload>
                <Form.Item name="coverImage" hidden><Input /></Form.Item>
              </Form.Item>
            </Col>
            <Col className="payment-field-equal" xs={12} md={12}><Form.Item name="subType" label="课程期次"><Input placeholder="如 2026 第一期" /></Form.Item></Col>
            <Col className="payment-field-equal" xs={12} md={12}><Form.Item name="teacher" label="授课教师"><Input /></Form.Item></Col>
            <Col className="payment-field-equal" xs={12} md={12}><Form.Item name="startDate" label="开始日期"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col className="payment-field-equal" xs={12} md={12}><Form.Item name="endDate" label="结束日期"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col className="payment-field-equal" xs={8} md={8}><Form.Item name="price" label="价格"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col className="payment-field-equal" xs={8} md={8}><Form.Item name="sessions" label="课次"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col className="payment-field-equal" xs={8} md={8}><Form.Item name="validDays" label="有效天数"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            {editingCourse && (
              <Col className="payment-field-remark" span={24}>
                <Card size="small">
                  <Text type="secondary">当前签到表：</Text>
                  {editingCourse.attendanceSheetPath ? <a href={editingCourse.attendanceSheetPath} target="_blank" rel="noreferrer">{editingCourse.attendanceSheetFilename || '查看已上传签到表'}</a> : <Text type="secondary">暂无签到表照片</Text>}
                </Card>
              </Col>
            )}
            <Col className="payment-field-remark" span={24}><Form.Item name="content" label="课程描述"><Input.TextArea autoSize={{ minRows: 1 }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        className="training-payment-modal training-compact-modal"
        title="新建学员"
        open={memberModalOpen}
        onCancel={() => setMemberModalOpen(false)}
        onOk={saveMember}
        confirmLoading={saving}
        width={640}
        destroyOnClose
      >
        <Form form={memberForm} layout="vertical">
          <Row className="payment-modal-grid" gutter={[8, 0]}>
            <Col className="payment-field-equal" xs={12} md={12}>
              <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入学员姓名' }]}>
                <Input placeholder="请输入学员姓名" maxLength={30} />
              </Form.Item>
            </Col>
            <Col className="payment-field-equal" xs={12} md={12}>
              <Form.Item
                name="phone"
                label="手机号/国际电话"
                rules={[
                  { required: true, message: '请输入手机号或国际电话' },
                  { pattern: INTERNATIONAL_PHONE_PATTERN, message: '请输入正确的手机号或国际电话' },
                ]}
              >
                <Input placeholder="如 13800138000 或 +1 555 123 4567" maxLength={24} />
              </Form.Item>
            </Col>
            <Col className="payment-field-equal" xs={12} md={12}>
              <Form.Item name="gender" label="性别">
                <Select options={[{ value: '女', label: '女' }, { value: '男', label: '男' }]} />
              </Form.Item>
            </Col>
            <Col className="payment-field-equal" xs={12} md={12}>
              <Form.Item name="level" label="等级">
                <Select options={[
                  { value: '普通学员', label: '普通学员' },
                  { value: '初级学员', label: '初级学员' },
                  { value: '中级学员', label: '中级学员' },
                  { value: '高级学员', label: '高级学员' },
                ]} />
              </Form.Item>
            </Col>
            <Col className="payment-field-equal" xs={12} md={12}>
              <Form.Item name="country" label="国家/地区" rules={[{ required: true, message: '请选择国家/地区' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={[
                    { value: '中国', label: '中国' },
                    ...overseasCountries.map(country => ({ value: country, label: country })),
                  ]}
                  onChange={() => memberForm.setFieldsValue({ province: undefined, city: undefined, foreignRegion: undefined })}
                />
              </Form.Item>
            </Col>
            {memberCountry === '中国' ? (
              <>
                <Col className="payment-field-equal" xs={12} md={12}>
                  <Form.Item name="province" label="省份" rules={[{ required: true, message: '请选择省份' }]}>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      options={chinaRegions.map(item => ({ value: item.province, label: item.province }))}
                      onChange={() => memberForm.setFieldsValue({ city: undefined })}
                    />
                  </Form.Item>
                </Col>
                <Col className="payment-field-equal" xs={12} md={12}>
                  <Form.Item name="city" label="城市" rules={[{ required: true, message: '请选择城市' }]}>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      disabled={!memberProvince}
                      options={memberCityOptions.map(city => ({ value: city, label: city }))}
                    />
                  </Form.Item>
                </Col>
              </>
            ) : (
              <Col className="payment-field-equal" xs={12} md={12}>
                <Form.Item name="foreignRegion" label="所在地区">
                  <Input placeholder="如州/省/城市，可选" />
                </Form.Item>
              </Col>
            )}
            <Col className="payment-field-equal" xs={12} md={12}>
              <Form.Item name="birthday" label="生日">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col className="payment-field-equal" xs={12} md={12}>
              <Form.Item name="register_date" label="登记日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="address" label="详细地址">
                <Input placeholder="街道、门牌号等，选填" maxLength={200} />
              </Form.Item>
            </Col>
            <Col className="payment-field-remark" span={24}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea autoSize={{ minRows: 1 }} placeholder="可填写来源、学习目标或其他备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal className="training-payment-modal training-compact-modal training-table-modal" title="添加学员" open={addMembersOpen} onCancel={() => setAddMembersOpen(false)} onOk={confirmAddMembers} confirmLoading={saving} width={760} destroyOnClose>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input prefix={<SearchOutlined />} placeholder="搜索姓名或手机号" value={memberSearch} onChange={event => setMemberSearch(event.target.value)} allowClear />
          <Text type="secondary">{detailCourse?.name || '当前课程'}：可添加 {addableMembers.length} 人，已选 {selectedAddMemberIds.length} 人，默认缴费 {formatPrice(0)}，课次按课程课次写入。</Text>
          <Table<Member>
            scroll={{ x: 'max-content' }}
            rowKey={(record) => Number(record.id)}
            size="small"
            dataSource={addableMembers}
            pagination={{ pageSize: 8 }}
            rowSelection={{ selectedRowKeys: selectedAddMemberIds, onChange: keys => setSelectedAddMemberIds(keys as number[]) }}
            columns={sortableColumns<Member>([
              { title: '姓名', dataIndex: 'name', render: value => <Text strong>{value}</Text> },
              { title: '手机号', dataIndex: 'phone', render: maskPhone },
              { title: '等级', dataIndex: 'level', render: value => value || '-' },
              { title: '默认金额', render: () => <Tag>{formatPrice(0)}</Tag> },
            ])}
          />
        </Space>
      </Modal>

      <Modal
        className="training-payment-modal training-compact-modal training-table-modal"
        title="发放证书"
        open={certificateModalOpen}
        onCancel={() => setCertificateModalOpen(false)}
        onOk={issueSelectedCertificates}
        okText={`发放 ${selectedCertificateMemberIds.length} 张`}
        okButtonProps={{ disabled: !selectedCertificateMemberIds.length }}
        confirmLoading={saving}
        width={900}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Row justify="space-between" align="middle" gutter={[12, 12]}>
            <Col>
              <Space size={8} wrap>
                <Text strong>{detailCourse?.name || '当前课程'}</Text>
                <Tag color="gold">总学员 {certificateSummary.total}</Tag>
                <Tag color="green">已发 {certificateSummary.issued}</Tag>
                <Tag color={certificateSummary.pending ? 'blue' : 'default'}>待发 {certificateSummary.pending}</Tag>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button size="small" onClick={() => setSelectedCertificateMemberIds(certificateStudents.filter(row => !row.issued).map(row => row.memberId))}>全选未发</Button>
                <Button size="small" onClick={() => setSelectedCertificateMemberIds([])}>清空</Button>
              </Space>
            </Col>
          </Row>
          <Text type="secondary">证书会写入统一证书库，学员可在学习中心“我的证书”和小程序证书接口查看；后台证书管理可继续配置模板、验证和撤销。</Text>
          <Table<CourseCertificateStudent>
            scroll={{ x: 'max-content' }}
            rowKey="memberId"
            size="small"
            loading={certificateLoading}
            dataSource={certificateStudents}
            pagination={{ pageSize: 8 }}
            rowSelection={{
              selectedRowKeys: selectedCertificateMemberIds,
              onChange: keys => setSelectedCertificateMemberIds(keys as number[]),
              getCheckboxProps: record => ({ disabled: record.issued }),
            }}
            locale={{ emptyText: <Empty description="当前课程暂无可发证学员" /> }}
            columns={sortableColumns<CourseCertificateStudent>([
              { title: '姓名', dataIndex: 'memberName', width: 120, render: value => <Text strong>{value}</Text> },
              { title: '手机号', dataIndex: 'memberPhone', width: 130, render: maskPhone },
              { title: '缴费次数', dataIndex: 'paymentCount', align: 'right' as const, width: 100, render: value => <Tag color={value > 1 ? 'orange' : 'blue'}>{value}次</Tag> },
              { title: '累计金额', dataIndex: 'totalAmount', align: 'right' as const, width: 120, render: money },
              { title: '剩余课次', dataIndex: 'remainingSessions', align: 'right' as const, width: 100, render: value => <Tag color={value > 0 ? 'green' : 'default'}>{value || 0}</Tag> },
              {
                title: '证书状态',
                width: 240,
                render: (_, record) => record.issued ? (
                  <Space size={8}>
                    <Tag color="green">已发</Tag>
                    <Text type="secondary">{record.issueDate || '-'}</Text>
                    {record.pdfUrl && <a href={record.pdfUrl} target="_blank" rel="noreferrer">查看</a>}
                  </Space>
                ) : <Tag color="blue">待发放</Tag>,
              },
              { title: '证书编号', dataIndex: 'certificateNo', width: 190, render: value => value ? <Text code>{value}</Text> : '-' },
            ])}
          />
        </Space>
      </Modal>

      <Modal className="training-payment-modal training-compact-modal training-table-modal" title="批量核销" open={batchConsumeOpen} onCancel={() => setBatchConsumeOpen(false)} onOk={executeBatchConsume} confirmLoading={saving} width={860} destroyOnClose>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Form form={batchForm} layout="vertical">
            <Row className="payment-modal-grid" gutter={[8, 0]}>
              <Col className="payment-field-remark" xs={24} md={12}>
                <Form.Item label="选择课程" required>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    value={batchCourseId}
                    onChange={(value) => { setBatchCourseId(value); setSelectedBatchPaymentIds([]); }}
                    options={courses.filter(course => consumableTypes.has(course.type)).map(course => ({ value: course.id, label: courseLabel(course) }))}
                  />
                </Form.Item>
              </Col>
              <Col className="payment-field-equal" xs={12} md={6}><Form.Item name="count" label="核销次数" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
              <Col className="payment-field-equal" xs={12} md={6}><Form.Item name="consumeDate" label="核销日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          </Form>
          <Row justify="space-between" align="middle">
            <Col><Text strong>选择要核销的学员</Text> <Text type="secondary">已选择 {selectedBatchPaymentIds.length} 人</Text></Col>
            <Col>
              <Space>
                <Button size="small" onClick={() => setSelectedBatchPaymentIds(batchStudents.map(item => item.id))}>全选</Button>
                <Button size="small" onClick={() => setSelectedBatchPaymentIds([])}>取消全选</Button>
              </Space>
            </Col>
          </Row>
          <Table<PaymentRow>
            scroll={{ x: 'max-content' }}
            rowKey="id"
            size="small"
            dataSource={batchStudents}
            pagination={{ pageSize: 8 }}
            rowSelection={{ selectedRowKeys: selectedBatchPaymentIds, onChange: keys => setSelectedBatchPaymentIds(keys as number[]) }}
            locale={{ emptyText: <Empty description={batchCourse ? '该课程暂无可核销学员' : '请先选择课程'} /> }}
            columns={sortableColumns<PaymentRow>([
              { title: '姓名', dataIndex: 'memberName', render: value => <Text strong>{value}</Text> },
              { title: '手机号', dataIndex: 'memberPhone' },
              { title: '剩余课次', dataIndex: 'remainingSessions', align: 'right' as const, render: value => <Tag color="green">剩 {value} 次</Tag> },
            ])}
          />
        </Space>
      </Modal>

      <Modal className="training-payment-modal training-compact-modal training-payment-record-modal" title={editingPayment ? '编辑缴费记录' : '新建缴费记录'} open={paymentModalOpen} onCancel={() => setPaymentModalOpen(false)} onOk={savePayment} confirmLoading={saving} width={620} destroyOnClose>
        <Form form={paymentForm} layout="vertical">
          <Row className="payment-modal-grid payment-record-grid" gutter={[8, 0]}>
            <Col className="payment-record-field payment-record-field-wide" xs={12} md={12}>
              <Form.Item name="memberId" label="学员" rules={[{ required: true, message: '请选择学员' }]}>
                <Select
                  className="payment-wide-select"
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  placeholder="姓名/手机号"
                  onSearch={setPaymentMemberSearch}
                  options={members.map(item => ({ value: Number(item.id), label: memberLabel(item) }))}
                  notFoundContent={
                    <div className="payment-select-empty">
                      <Text type="secondary">未找到学员</Text>
                      <Button type="primary" size="small" icon={<PlusOutlined />} onMouseDown={event => event.preventDefault()} onClick={() => openMemberModal(paymentMemberSearch)}>
                        新建学员
                      </Button>
                    </div>
                  }
                />
              </Form.Item>
            </Col>
            <Col className="payment-record-field payment-record-field-wide" xs={12} md={12}>
              <Form.Item name="courseId" label="课程" rules={[{ required: true, message: '请选择课程' }]}>
                <Select
                  className="payment-wide-select"
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  placeholder="课程名称"
                  onSearch={setPaymentCourseSearch}
                  options={courses.map(item => ({ value: item.id, label: courseLabel(item), row: item }))}
                  onChange={(id) => {
                    const course = courses.find(item => item.id === id);
                    paymentForm.setFieldsValue({ courseSubType: course?.subType || '', amount: course?.price || 0, remainingSessions: course?.sessions || 0, sales: course?.teacher || '' });
                  }}
                  notFoundContent={
                    <div className="payment-select-empty">
                      <Text type="secondary">未找到课程</Text>
                      <Button type="primary" size="small" icon={<PlusOutlined />} onMouseDown={event => event.preventDefault()} onClick={() => openCourseCreateFromSearch(paymentCourseSearch)}>
                        新建课程
                      </Button>
                    </div>
                  }
                />
              </Form.Item>
            </Col>
            <Col className="payment-record-field payment-record-field-medium" xs={12} md={12}>
              <Form.Item name="courseSubType" label="课程期次">
                <Input placeholder="如 2026 第一期" />
              </Form.Item>
            </Col>
            <Col className="payment-record-field payment-record-field-date" xs={12} md={12}><Form.Item name="date" label="缴费日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col className="payment-record-field payment-record-field-small" xs={12} md={12}><Form.Item name="amount" label="实付金额"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col className="payment-record-field payment-record-field-small" xs={12} md={12}><Form.Item name="payment" label="支付方式"><Select options={paymentMethods.map(value => ({ value, label: value }))} /></Form.Item></Col>
            <Col className="payment-record-field payment-record-field-small" xs={12} md={12}><Form.Item name="sales" label="课程顾问"><Input /></Form.Item></Col>
            <Col className="payment-record-field payment-record-field-small" xs={12} md={12}><Form.Item name="remainingSessions" label="剩余课次"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col className="payment-record-field payment-record-field-voucher" xs={12} md={12}>
              <Form.Item label="上传付款凭证">
                <Space size={8} style={{ width: '100%' }} className="payment-voucher-row">
                  <input
                    ref={paymentVoucherInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={event => handlePaymentVoucherChange(event.currentTarget.files?.[0])}
                  />
                  <Button className="payment-voucher-button" icon={<UploadOutlined />} loading={saving} onClick={() => paymentVoucherInputRef.current?.click()}>
                    {paymentVoucher?.voucherPath ? '更换图片' : '选择图片'}
                  </Button>
                  {paymentVoucher?.voucherFilename && <Text type="secondary" ellipsis className="payment-voucher-name">{paymentVoucher.voucherFilename}</Text>}
                  {paymentVoucher?.voucherPath && (
                    <a href={paymentVoucher.voucherPath} target="_blank" rel="noreferrer" className="payment-voucher-thumb">
                      <img
                        src={paymentVoucher.voucherPath}
                        alt="付款凭证"
                        style={{ width: 40, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }}
                      />
                    </a>
                  )}
                </Space>
              </Form.Item>
            </Col>
            <Col className="payment-record-field payment-record-field-remark" span={24}><Form.Item name="remark" label="备注"><Input.TextArea autoSize={{ minRows: 1 }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal className="training-payment-modal training-compact-modal" title={editingConsume?.id ? '编辑核销记录' : '单个核销'} open={consumeModalOpen} onCancel={() => setConsumeModalOpen(false)} onOk={saveConsume} confirmLoading={saving} width={720} destroyOnClose>
        <Form form={consumeForm} layout="vertical">
          <Row className="payment-modal-grid" gutter={[8, 0]}>
            {!editingConsume?.id && (
              <>
                <Col className="payment-field-equal" xs={12} md={12}>
                  <Form.Item name="memberId" label="选择学员" rules={[{ required: true, message: '请选择学员' }]}>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="先选择学员"
                      options={consumeMemberOptions}
                      onChange={() => consumeForm.setFieldValue('paymentId', undefined)}
                    />
                  </Form.Item>
                </Col>
                <Col className="payment-field-equal" xs={12} md={12}>
                  <Form.Item name="paymentId" label="选择已有课程" rules={[{ required: true, message: '请选择该学员已有课程' }]}>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder={consumeMemberId ? '选择可核销课程' : '请先选择学员'}
                      disabled={!consumeMemberId}
                      options={paymentOptions}
                      notFoundContent={consumeMemberId ? '该学员暂无可核销课程' : '请先选择学员'}
                    />
                  </Form.Item>
                </Col>
              </>
            )}
            {editingConsume?.id && (
              <Col className="payment-field-remark" span={24}>
                <Form.Item label="核销课程">
                  <Input value={`${editingConsume.memberName || ''} / ${editingConsume.courseName || ''}`} disabled />
                </Form.Item>
              </Col>
            )}
            <Col className="payment-field-equal" xs={12} md={12}><Form.Item name="consumeDate" label="核销日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col className="payment-field-equal" xs={12} md={12}><Form.Item name="count" label="核销次数" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col className="payment-field-remark" span={24}><Form.Item name="remark" label="备注"><Input.TextArea autoSize={{ minRows: 1 }} placeholder="核销说明" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
