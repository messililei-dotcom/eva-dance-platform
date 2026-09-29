'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './members.module.css';
import { useRouter } from 'next/navigation';
import { App, Avatar, Button, Card, Col, DatePicker, Empty, Form, Input, Modal, Progress, Row, Select, Space, Spin, Statistic, Tag, Tooltip, Typography } from 'antd';
import { Table } from '@/components/adaptive-table';
import { DeleteOutlined, PhoneOutlined, ReloadOutlined, SearchOutlined, TeamOutlined, UserAddOutlined, UserOutlined, WalletOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { platformAdapter } from '@/lib/adapters/platform';
import { getDefaultRegions } from '@/lib/regions';
import api from '@/lib/api';
import { getMemberIdentity, memberSearchText, shortWxId } from '@/lib/member-search';
import { formatPaymentAmount } from '@/lib/money-format';
import { sortableColumns } from '@/lib/table-sort';
import type { Member } from '@/types/domain';

const { Text, Title } = Typography;

const levelColors: Record<string, string> = {
  '卓越舞者 Lv.5': 'gold',
  '资深舞者 Lv.4': 'magenta',
  '舞韵学员 Lv.3': 'purple',
  '律动学员 Lv.2': 'blue',
  '初舞学员 Lv.1': 'default',
  高级学员: 'magenta',
  中级学员: 'purple',
  初级学员: 'blue',
  普通学员: 'default',
  高级会员: 'magenta',
  中级会员: 'purple',
  普通会员: 'default',
};

const activeStatuses = new Set(['active', '正常', 'enabled']);
const INTERNATIONAL_PHONE_PATTERN = /^\+?[0-9\s()-]{6,24}$/;

function displayStudentText(value: string) {
  return value ? value.replace(/会员/g, '学员') : value;
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function moneyValue(value: unknown) {
  return formatPaymentAmount(value);
}

function wanMoneyValue(value: unknown) {
  return `¥${(numberValue(value) / 10000).toFixed(2)}万`;
}

function dateValue(value?: string) {
  const text = String(value || '').slice(0, 10);
  return text && text !== '-' ? text : '';
}

function isMemberDirectoryRecord(member: Member) {
  const raw = member.raw || {};
  return !(raw.source === 'certificate-import' && !member.phone);
}

function memberAvatarSource(member?: Pick<Member, 'avatar' | 'raw'> | null) {
  return String(member?.avatar || member?.raw?.avatar || member?.raw?.avatarUrl || member?.raw?.avatar_url || '');
}

export default function MembersPage() {
  const { message, modal } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm();
  const createCountry = Form.useWatch('country', form);
  const createProvince = Form.useWatch('province', form);
  const avatarPreview = Form.useWatch('avatar', form);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [regions, setRegions] = useState(getDefaultRegions);
  const [orderRevenue, setOrderRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [courseMember, setCourseMember] = useState<Member | null>(null);
  const [courseRows, setCourseRows] = useState<Array<Record<string, any>>>([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState('all');
  const [city, setCity] = useState('all');
  const [activity, setActivity] = useState('all');

  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState('');
  const [syncError, setSyncError] = useState(false);
  const requestSequence = useRef(0);
  const inFlight = useRef(false);
  const loadMembers = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const sequence = ++requestSequence.current;
    setSyncing(true);
    try {
      const directory = await platformAdapter.getMemberDirectory();
      if (sequence !== requestSequence.current) return;
      setMembers(directory.members.filter(isMemberDirectoryRecord));
      setOrderRevenue(directory.orderRevenue);
      setSyncedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
      setSyncError(false);
    } catch {
      if (sequence === requestSequence.current) setSyncError(true);
    } finally {
      inFlight.current = false;
      if (sequence === requestSequence.current) { setLoading(false); setSyncing(false); }
    }
  }, []);

  useEffect(() => {
    void loadMembers();
    platformAdapter.getRegions().then(setRegions).catch(() => {});
    return () => {
      ++requestSequence.current;
    };
  }, [loadMembers]);

  const levels = useMemo(() => ['all', ...Array.from(new Set(members.map(item => item.level).filter(Boolean)))], [members]);
  const cities = useMemo(() => ['all', ...Array.from(new Set(members.map(item => item.city).filter(item => item && item !== '-')))], [members]);
  const chinaRegions = useMemo(() => regions.filter(item => item.province !== '海外'), [regions]);
  const overseasCountries = useMemo(() => regions.find(item => item.province === '海外')?.cities || [], [regions]);
  const createCityOptions = useMemo(() => chinaRegions.find(item => item.province === createProvince)?.cities || [], [chinaRegions, createProvince]);
  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return members.filter(item => {
      if (item.status === 'merged' && activity !== 'merged') return false;
      const matchKeyword = !q || `${memberSearchText(item)} ${item.city || ''} ${item.raw?.address || ''}`.includes(q);
      const matchLevel = level === 'all' || item.level === level;
      const matchCity = city === 'all' || item.city === city;
      const matchActivity = activity === 'all'
        || (activity === 'merged' && item.status === 'merged')
        || (activity === 'active' && item.totalSpent > 0)
        || (activity === 'new-month' && dateValue(item.registerDate).startsWith(new Date().toISOString().slice(0, 7)))
        || (activity === 'high-value' && item.totalSpent >= 5000)
        || (activity === 'inactive' && item.totalSpent <= 0);
      return matchKeyword && matchLevel && matchCity && matchActivity;
    });
  }, [members, keyword, level, city, activity]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMembers = members.filter(item => item.status !== 'merged');
  const activeCount = currentMembers.filter(item => activeStatuses.has(item.status)).length;
  const newThisMonth = currentMembers.filter(item => dateValue(item.registerDate).startsWith(currentMonth)).length;

  const openCreate = () => {
    setEditingMember(null);
    form.resetFields();
    form.setFieldsValue({ gender: '女', country: '中国', avatar: '' });
    setCreateOpen(true);
  };

  const toDatePickerValue = (value?: string) => {
    const text = dateValue(value);
    return text ? dayjs(text) : undefined;
  };

  const openEdit = (member: Member) => {
    const raw = member.raw || {};
    setEditingMember(member);
    form.setFieldsValue({
      name: member.name,
      phone: member.phone,
      gender: raw.gender || '女',
      birthday: toDatePickerValue(String(raw.birthday || '')),
      country: member.country || '中国',
      province: raw.province || '',
      city: member.city && member.city !== '-' ? member.city : '',
      foreignRegion: raw.foreignRegion || '',
      address: raw.address || '',
      register_date: toDatePickerValue(member.registerDate),
      remark: raw.remark || '',
      avatar: memberAvatarSource(member),
    });
    setCreateOpen(true);
  };

  const openCourseProgress = async (member: Member) => {
    setCourseMember(member);
    setCourseRows([]);
    setCourseLoading(true);
    try {
      const profile = await platformAdapter.getMemberProfile(member.id);
      const courses = (profile as any).courses;
      setCourseRows(Array.isArray(courses) ? courses : []);
    } catch (error: any) {
      message.error(error?.response?.data?.error || error?.message || '课程学习进度加载失败');
    } finally {
      setCourseLoading(false);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.error('头像仅支持图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('头像图片不能超过 5MB');
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('memberName', form.getFieldValue('name') || editingMember?.name || 'member');
      const currentAvatar = form.getFieldValue('avatar');
      const existingAvatar = memberAvatarSource(editingMember);
      if (currentAvatar && currentAvatar !== existingAvatar) formData.append('oldPath', currentAvatar);
      const res = await platformAdapter.uploadMemberAvatar(formData);
      const avatar = res?.data?.avatar || '';
      if (!avatar) throw new Error('上传头像失败');
      form.setFieldValue('avatar', avatar);
      message.success('头像已上传');
    } catch (error: any) {
      message.error(error?.response?.data?.error || error?.response?.data?.message || error?.message || '上传头像失败');
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      setAvatarUploading(false);
    }
  };

  const saveMember = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = {
        name: values.name.trim(),
        phone: values.phone.trim(),
        gender: values.gender,
        birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : '',
        register_date: values.register_date ? values.register_date.format('YYYY-MM-DD') : '',
        country: values.country || '中国',
        province: values.country === '中国' ? values.province || '' : '',
        city: values.country === '中国' ? values.city || '' : '',
        foreignRegion: values.country === '中国' ? '' : values.foreignRegion || values.country || '',
        address: values.address || '',
        remark: values.remark || '',
        avatar: values.avatar || '',
        previousAvatar: editingMember ? memberAvatarSource(editingMember) : '',
      };
      if (editingMember) await platformAdapter.updateMember(editingMember.id, payload);
      else await platformAdapter.createMember(payload);
      message.success(editingMember ? '编辑学员成功' : '新建学员成功');
      setCreateOpen(false);
      setEditingMember(null);
      loadMembers();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || (editingMember ? '编辑学员失败' : '新建学员失败');
      message.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const deleteMember = (member: Member) => {
    modal.confirm({
      title: `确定删除学员「${member.name}」吗？`,
      content: '删除后该学员将不再出现在学员列表中；若仍有未核销课时，系统会阻止删除。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await platformAdapter.deleteMember(member.id);
          message.success('学员已删除');
          loadMembers();
        } catch (error: any) {
          const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || '删除学员失败';
          message.warning(errorMessage);
        }
      },
    });
  };

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div className={styles.page}>
      <div className="page-header">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={2}>学员信息</Title>
            <Text type="secondary">统一学员信息入口，沉淀线下培训、网课、订单、财务和成长数据。</Text>
          </Col>
          <Col>
            <Space>
              <Text type={syncError ? 'danger' : 'secondary'}>{syncError ? '同步失败，请重试' : syncedAt ? `已同步 ${syncedAt} · 打开页面或手动刷新时更新` : '正在同步'}</Text>
              <Button loading={syncing} icon={<ReloadOutlined />} onClick={() => void loadMembers()}>刷新</Button>
              <Button type="primary" icon={<UserAddOutlined />} onClick={openCreate}>新建学员</Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Card className="members-stat-summary-card" styles={{ body: { padding: 0 } }}>
        <div className="members-stat-grid">
          <div className="members-stat-item"><Statistic title="学员总数" value={currentMembers.length} prefix={<UserOutlined />} /></div>
          <div className="members-stat-item"><Statistic title="正常账号" value={activeCount} prefix={<TeamOutlined />} valueStyle={{ color: '#22C55E' }} /></div>
          <div className="members-stat-item"><Statistic title="本月新增" value={newThisMonth} prefix={<UserAddOutlined />} valueStyle={{ color: '#3B82F6' }} /></div>
          <div className="members-stat-item"><Statistic title="累计消费" value={orderRevenue} prefix={<WalletOutlined />} formatter={value => wanMoneyValue(value)} valueStyle={{ color: '#F72A8A' }} /></div>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} lg={7}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索姓名、手机号、Member ID、微信ID、城市"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={6} lg={4}>
            <Select
              value={level}
              onChange={setLevel}
              style={{ width: '100%' }}
              options={levels.map(item => ({ value: item, label: item === 'all' ? '全部等级' : displayStudentText(item) }))}
            />
          </Col>
          <Col xs={24} md={6} lg={4}>
            <Select
              value={city}
              onChange={setCity}
              style={{ width: '100%' }}
              options={cities.map(item => ({ value: item, label: item === 'all' ? '全部城市' : item }))}
            />
          </Col>
          <Col xs={24} md={6} lg={5}>
            <Select
              value={activity}
              onChange={setActivity}
              style={{ width: '100%' }}
              options={[
                { value: 'all', label: '全部学员（不含合并档案）' },
                { value: 'merged', label: '已合并档案' },
                { value: 'active', label: '活跃学员' },
                { value: 'new-month', label: '本月新增' },
                { value: 'high-value', label: '高价值学员' },
                { value: 'inactive', label: '未消费学员' },
              ]}
            />
          </Col>
          <Col xs={24} lg={4}><Text type="secondary">显示 {filtered.length} / {members.length}</Text></Col>
        </Row>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          className="members-table"
          rowKey="id"
          size="small"
          adaptiveBottomGap={12}
          dataSource={filtered}
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 位学员` }}
          locale={{ emptyText: <Empty description="暂无学员数据" /> }}
          onRow={record => ({
            onClick: () => openEdit(record),
            style: { cursor: 'pointer' },
          })}
          columns={sortableColumns<Member>([
            {
              title: '学员信息',
              dataIndex: 'name',
              fixed: 'left',
              width: 220,
              className: 'members-student-info-cell',
              onHeaderCell: () => ({ className: 'members-student-info-cell' }),
              render: (_, record) => (
                <div className="members-student-info">
                  <Avatar size={32} src={memberAvatarSource(record) || undefined} style={{ background: 'linear-gradient(135deg,#F72A8A,#7C3AED)' }}>{record.name[0]}</Avatar>
                  <div className="members-student-info-text">
                    <Text strong>{record.name}</Text>
                    <div><Text type="secondary"><PhoneOutlined /> {record.phone || '-'}</Text></div>
                  </div>
                </div>
              ),
            },
            {
              title: 'Member ID',
              dataIndex: 'id',
              width: 112,
              render: value => <Text copyable={{ text: String(value || '') }}>{value || '-'}</Text>,
            },
            {
              title: '微信ID',
              width: 190,
              render: (_, record) => {
                const identity = getMemberIdentity(record);
                const id = identity.wxUnionid || identity.wxOpenid;
                if (record.status === 'merged') return <Button type="link" size="small" disabled={!record.raw?.mergedInto} onClick={event => { event.stopPropagation(); router.push(`/members/${record.raw?.mergedInto}`); }}>已合并至 {String(record.raw?.mergedInto || '主账号')}</Button>;
                const kind = identity.wxUnionid ? 'UnionID' : 'OpenID';
                if (!id) return <Text type="secondary">未绑定</Text>;
                return (
                  <Tooltip title={`${kind}: ${id}`}>
                    <div className="members-wechat-info"><Tag color="green">已绑定</Tag><Text copyable={{ text: id }}>{kind}: {shortWxId(id)}</Text></div>
                  </Tooltip>
                );
              },
            },
            { title: '等级', dataIndex: 'level', width: 92, render: value => <Tag color={levelColors[value] || 'default'}>{displayStudentText(value)}</Tag> },
            { title: '状态', dataIndex: 'status', width: 76, render: value => <Tag color={activeStatuses.has(value) ? 'green' : 'default'}>{activeStatuses.has(value) ? '正常' : (({ inactive: '已停用', merged: '已合并' } as Record<string, string>)[String(value)] || value || '-')}</Tag> },
            { title: '城市', dataIndex: 'city', width: 88, ellipsis: true },
            { title: '注册日期', dataIndex: 'registerDate', width: 108 },
            {
              title: '课程总数',
              dataIndex: 'courseCount',
              align: 'right' as const,
              width: 126,
              render: (value, record) => (
                <Button
                  type="link"
                  size="small"
                  disabled={!numberValue(value)}
                  style={{ height: 'auto', padding: 0 }}
                  aria-label={`查看 ${record.name} 的课程与学习进度`}
                  onClick={event => {
                    event.stopPropagation();
                    openCourseProgress(record);
                  }}
                >
                  {numberValue(value)}
                  <div style={{ fontSize: 11, color: '#64748b' }}>线上 {numberValue(record.raw?.onlineCourseCount)} · 线下 {numberValue(record.raw?.offlineCourseCount)}</div>
                </Button>
              ),
            },
            { title: '累计消费', dataIndex: 'totalSpent', align: 'right' as const, width: 108, render: value => <Text strong style={{ color: '#F72A8A' }}>{moneyValue(value)}</Text> },
            {
              title: '操作',
              fixed: 'right',
              width: 110,
              render: (_, record) => (
                <Space size={4}>
                  <Button
                    size="small"
                    aria-label={`查看 ${record.name} 详情`}
                    onClick={event => {
                      event.stopPropagation();
                      router.push(`/members/${record.id}`);
                    }}
                  >
                    详情
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    title="删除"
                    aria-label={`删除 ${record.name}`}
                    onClick={event => {
                      event.stopPropagation();
                      deleteMember(record);
                    }}
                  />
                </Space>
              ),
            },
          ])}
        />
      </Card>

      <Modal
        title={courseMember ? `${courseMember.name} · 课程与学习进度` : '课程与学习进度'}
        open={Boolean(courseMember)}
        onCancel={() => setCourseMember(null)}
        footer={null}
        width={900}
        destroyOnClose
      >
        <Table
          rowKey={record => String(record.id)}
          size="middle"
          loading={courseLoading}
          dataSource={courseRows}
          scroll={{ x: 760, y: 'min(52dvh, 480px)' }}
          pagination={false}
          locale={{ emptyText: <Empty description={courseLoading ? '正在加载课程' : '暂无课程记录'} /> }}
          columns={[
            { title: '课程', dataIndex: 'name', width: 260, render: value => <Text strong>{value || '未命名课程'}</Text> },
            { title: '类型', dataIndex: 'type', width: 90, render: value => <Tag color={value === 'online' ? 'magenta' : 'blue'}>{value === 'online' ? '线上课程' : '线下课程'}</Tag> },
            { title: '学习进度', dataIndex: 'progressPercent', width: 190, render: value => <Progress percent={numberValue(value)} size="small" /> },
            {
              title: '进度明细',
              width: 130,
              render: (_, record) => record.type === 'online'
                ? `${numberValue(record.watchedVideos)} / ${numberValue(record.totalVideos)} 个视频`
                : `${numberValue(record.completedSessions)} / ${numberValue(record.totalSessions)} 课次`,
            },
            { title: '状态', dataIndex: 'statusText', width: 90, render: (value, record) => <Tag color={record.status === 'completed' ? 'green' : record.status === 'learning' ? 'processing' : 'default'}>{value || '未开始'}</Tag> },
          ]}
        />
      </Modal>

      <Modal
        title={editingMember ? '编辑学员' : '新建学员'}
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          setEditingMember(null);
        }}
        onOk={saveMember}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="avatar" hidden>
            <Input />
          </Form.Item>
          <div className="member-avatar-editor">
            <button
              type="button"
              className="member-avatar-upload-trigger"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              aria-label={avatarPreview ? '更换头像' : '上传头像'}
              title={avatarPreview ? '点击更换头像' : '点击上传头像'}
            >
              <Avatar size={64} src={avatarPreview || undefined} style={{ background: 'linear-gradient(135deg,#F72A8A,#7C3AED)', flex: '0 0 auto' }}>
                {(form.getFieldValue('name') || editingMember?.name || '学')[0]}
              </Avatar>
              {avatarUploading && <span className="member-avatar-uploading">上传中</span>}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={event => uploadAvatar(event.currentTarget.files?.[0])}
            />
            <Space size={8} wrap>
              {avatarPreview && (
                <Button
                  icon={<DeleteOutlined />}
                  onClick={() => form.setFieldValue('avatar', '')}
                >
                  清除
                </Button>
              )}
            </Space>
          </div>
          <Row gutter={12}>
            <Col xs={12} sm={12}>
              <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                <Input placeholder="请输入学员姓名" maxLength={30} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={12}>
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
            <Col xs={12} sm={12}>
              <Form.Item name="gender" label="性别">
                <Select options={[{ value: '女', label: '女' }, { value: '男', label: '男' }]} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={12}>
              <Form.Item label="等级（系统自动）">
                <Input value={editingMember?.level || '初舞学员 Lv.1'} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={12} sm={12}>
              <Form.Item name="country" label="国家/地区" rules={[{ required: true, message: '请选择国家/地区' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={[
                    { value: '中国', label: '中国' },
                    ...overseasCountries.map(country => ({ value: country, label: country })),
                  ]}
                  onChange={() => form.setFieldsValue({ province: undefined, city: undefined, foreignRegion: undefined })}
                />
              </Form.Item>
            </Col>
            {createCountry === '中国' ? (
              <Col xs={12} sm={12}>
                <Form.Item name="province" label="省份" rules={[{ required: true, message: '请选择省份' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={chinaRegions.map(item => ({ value: item.province, label: item.province }))}
                    onChange={() => form.setFieldsValue({ city: undefined })}
                  />
                </Form.Item>
              </Col>
            ) : (
              <Col xs={12} sm={12}>
                <Form.Item name="foreignRegion" label="所在地区">
                  <Input placeholder="如州/省/城市，可选" />
                </Form.Item>
              </Col>
            )}
          </Row>
          {createCountry === '中国' && (
            <Form.Item name="city" label="城市" rules={[{ required: true, message: '请选择城市' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                disabled={!createProvince}
                options={createCityOptions.map(city => ({ value: city, label: city }))}
              />
            </Form.Item>
          )}
          <Form.Item name="address" label="详细地址">
            <Input placeholder="街道、门牌号等，选填" maxLength={200} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={12} sm={12}>
              <Form.Item name="birthday" label="生日">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={12}>
              <Form.Item name="register_date" label="登记日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可填写来源、学习目标或其他备注" maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
