'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge, Button, Card, Col, Collapse, Empty, Form, Input, message, Modal, Row, Select,
  Space, Spin, Statistic, Switch, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd';
import {
  DeleteOutlined, EditOutlined, LockOutlined, PlusOutlined, SafetyOutlined,
  StopOutlined, CheckCircleOutlined, TeamOutlined, UserOutlined,
} from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import { sortableColumns } from '@/lib/table-sort';
import type { PermissionUser } from '@/types/domain';

const { Text, Title } = Typography;
const { confirm } = Modal;

// 权限分类定义
const PERMISSION_GROUPS = [
  {
    key: 'course',
    label: '课程权限',
    permissions: [
      { field: 'permCourseView', label: '查看课程' },
      { field: 'permCourseCreate', label: '创建课程' },
      { field: 'permCourseEdit', label: '编辑课程' },
      { field: 'permCourseDelete', label: '删除课程' },
    ],
  },
  {
    key: 'member',
    label: '学员权限',
    permissions: [
      { field: 'permMemberView', label: '查看学员' },
      { field: 'permMemberCreate', label: '新增学员' },
      { field: 'permMemberEdit', label: '编辑学员' },
      { field: 'permMemberDelete', label: '删除学员' },
    ],
  },
  {
    key: 'teacher',
    label: '课程顾问权限',
    permissions: [
      { field: 'permTeacherView', label: '查看课程顾问' },
      { field: 'permTeacherCreate', label: '新增课程顾问' },
      { field: 'permTeacherEdit', label: '编辑课程顾问' },
      { field: 'permTeacherDelete', label: '删除课程顾问' },
    ],
  },
  {
    key: 'payment',
    label: '缴费权限',
    permissions: [
      { field: 'permPaymentView', label: '查看缴费' },
      { field: 'permPaymentCreate', label: '新增缴费' },
      { field: 'permPaymentEdit', label: '编辑缴费' },
      { field: 'permPaymentDelete', label: '删除缴费' },
    ],
  },
  {
    key: 'consume',
    label: '核销权限',
    permissions: [
      { field: 'permConsumeView', label: '查看核销' },
      { field: 'permConsumeCreate', label: '新增核销' },
      { field: 'permConsumeEdit', label: '编辑核销' },
      { field: 'permConsumeDelete', label: '删除核销' },
    ],
  },
  {
    key: 'log',
    label: '日志权限',
    permissions: [
      { field: 'permLogView', label: '查看日志' },
    ],
  },
];

const ROLE_OPTIONS = [
  { value: 'admin', label: '管理员' },
  { value: 'teacher', label: '教师' },
  { value: 'user', label: '普通用户' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '禁用' },
];

// 权限字段列表
const ALL_PERM_FIELDS = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.field));

export default function PermissionsPage() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState<PermissionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);

  // 新建/编辑弹窗
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingUser, setEditingUser] = useState<PermissionUser | null>(null);
  const [userForm] = Form.useForm();
  const [permValues, setPermValues] = useState<Record<string, boolean>>({});
  const [showPermSettings, setShowPermSettings] = useState(false);

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await platformAdapter.getPermissionUsers();
      setUsers(data);
    } catch (err: any) {
      message.error('加载用户列表失败: ' + (err?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 统计
  const adminCount = useMemo(() => users.filter(u => u.role === 'admin').length, [users]);
  const teacherCount = useMemo(() => users.filter(u => u.role === 'teacher').length, [users]);
  const userCount = useMemo(() => users.filter(u => u.role === 'user').length, [users]);
  const activeCount = useMemo(() => users.filter(u => u.status === 'active').length, [users]);

  // 打开新建弹窗
  const openCreateModal = () => {
    setModalMode('create');
    setEditingUser(null);
    setPermValues({});
    setShowPermSettings(false);
    userForm.resetFields();
    userForm.setFieldsValue({ role: 'teacher', status: 'active' });
    setModalOpen(true);
  };

  // 打开编辑弹窗
  const openEditModal = (user: PermissionUser) => {
    setModalMode('edit');
    setEditingUser(user);
    setShowPermSettings(false);

    // 初始化权限值
    const perms: Record<string, boolean> = {};
    for (const field of ALL_PERM_FIELDS) {
      perms[field] = !!(user as any)[field] || (user.username === 'lilei');
    }
    setPermValues(perms);

    userForm.resetFields();
    userForm.setFieldsValue({
      username: user.username,
      name: user.name,
      role: user.role,
      status: user.status,
      password: '',
    });

    setModalOpen(true);
  };

  // 关闭弹窗
  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setShowPermSettings(false);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await userForm.validateFields();
      setModalLoading(true);

      if (modalMode === 'create') {
        const res = await platformAdapter.createUser({
          username: values.username,
          password: values.password,
          name: values.name,
          role: values.role || 'teacher',
          status: values.status || 'active',
        });
        if (res.success) {
          message.success('用户创建成功');
          closeModal();
          await loadUsers();
        } else {
          message.error(res.error || '创建失败');
        }
      } else if (editingUser) {
        const updateData: Record<string, any> = {};
        if (values.username !== editingUser.username) updateData.username = values.username;
        if (values.name !== editingUser.name) updateData.name = values.name;
        if (values.role !== editingUser.role) updateData.role = values.role;
        if (values.status !== editingUser.status) updateData.status = values.status;
        if (values.password) updateData.password = values.password;

        // 权限字段（lilei 不更新权限）
        if (editingUser.username !== 'lilei') {
          for (const field of ALL_PERM_FIELDS) {
            const currentVal = !!(editingUser as any)[field];
            if (permValues[field] !== currentVal) {
              updateData[field] = permValues[field];
            }
          }
        }

        if (Object.keys(updateData).length === 0) {
          message.info('没有需要更新的内容');
          setModalLoading(false);
          return;
        }

        const res = await platformAdapter.updateUser(editingUser.id, updateData);
        if (res.success) {
          message.success('用户更新成功');
          closeModal();
          await loadUsers();
        } else {
          message.error(res.error || '更新失败');
        }
      }
    } catch (err: any) {
      if (err?.response?.data?.error) {
        message.error(err.response.data.error);
      } else if (err?.message) {
        message.error(err.message);
      }
    } finally {
      setModalLoading(false);
    }
  };

  // 删除确认
  const handleDelete = (user: PermissionUser) => {
    confirm({
      title: `确认删除用户 "${user.name}"？`,
      content: (
        <div>
          <p>用户名：{user.username}</p>
          <Text type="danger">此操作不可恢复！</Text>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await platformAdapter.deleteUser(user.id);
          if (res.success) {
            message.success('用户已删除');
            await loadUsers();
          } else {
            message.error(res.error || '删除失败');
          }
        } catch (err: any) {
          message.error(err?.response?.data?.error || err?.message || '删除失败');
        }
      },
    });
  };

  // 切换状态
  const handleToggleStatus = async (user: PermissionUser) => {
    try {
      const res = await platformAdapter.toggleUserStatus(user.id);
      if (res.success) {
        message.success(res.message || `用户状态已变更`);
        await loadUsers();
      } else {
        message.error(res.error || '操作失败');
      }
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '操作失败');
    }
  };

  // 计算用户的权限数
  const countPermissions = (user: PermissionUser) => {
    if (user.username === 'lilei') return ALL_PERM_FIELDS.length;
    return ALL_PERM_FIELDS.filter(f => !!(user as any)[f]).length;
  };

  // 获取用户的权限标签列表
  const getPermissionTags = (user: PermissionUser) => {
    if (user.username === 'lilei') {
      return ALL_PERM_FIELDS.map(f => {
        const found = PERMISSION_GROUPS.flatMap(g => g.permissions).find(p => p.field === f);
        return found?.label || f;
      });
    }
    return ALL_PERM_FIELDS.filter(f => !!(user as any)[f]).map(f => {
      const found = PERMISSION_GROUPS.flatMap(g => g.permissions).find(p => p.field === f);
      return found?.label || f;
    });
  };

  // 用户表格列
  const userColumns = sortableColumns<PermissionUser>([
    { title: '用户名', dataIndex: 'username', width: 130 },
    {
      title: '姓名', dataIndex: 'name', width: 130,
      render: (value: string, record: PermissionUser) => (
        record.username === 'lilei'
          ? <Space><Text strong>{value}</Text><Tag color="red">超级管理员</Tag></Space>
          : value
      ),
    },
    {
      title: '角色', dataIndex: 'role', width: 120,
      render: (value: string) => {
        const colorMap: Record<string, string> = { admin: 'red', teacher: 'blue', user: 'green' };
        const labelMap: Record<string, string> = { admin: '管理员', teacher: '教师', user: '普通用户' };
        return <Tag color={colorMap[value] || 'default'}>{labelMap[value] || value}</Tag>;
      },
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (value: string, record: PermissionUser) => {
        if (record.username === 'lilei') return <Tag icon={<LockOutlined />} color="red">永久启用</Tag>;
        return value === 'active'
          ? <Tag icon={<CheckCircleOutlined />} color="success">启用</Tag>
          : <Tag icon={<StopOutlined />} color="error">禁用</Tag>;
      },
    },
    {
      title: '权限数', dataIndex: 'id', width: 90,
      render: (_: any, record: PermissionUser) => (
        <Badge count={countPermissions(record)} style={{ backgroundColor: '#F72A8A' }} />
      ),
    },
    {
      title: '权限详情', width: 300,
      render: (_: any, record: PermissionUser) => {
        const tags = getPermissionTags(record);
        return tags.length
          ? tags.map((item: string) => <Tag key={item} style={{ marginBottom: 2 }}>{item}</Tag>)
          : <Text type="secondary">无权限</Text>;
      },
    },
    {
      title: '操作', key: 'action', width: 220, fixed: 'right' as const,
      render: (_: any, record: PermissionUser) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          {record.username !== 'lilei' && (
            <>
              <Button
                type="link"
                icon={record.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />}
                onClick={() => handleToggleStatus(record)}
              >
                {record.status === 'active' ? '禁用' : '启用'}
              </Button>
              <Tooltip title="删除">
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="删除"
                  onClick={() => handleDelete(record)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ]);

  // 权限开关组件
  const renderPermissionSwitches = () => {
    const isLilei = editingUser?.username === 'lilei';
    return (
      <div style={{ marginTop: 16 }}>
        <Title level={5}>
          权限设置
          {isLilei && <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>（超级管理员自动拥有所有权限）</Text>}
        </Title>
        <Row gutter={[16, 16]}>
          {PERMISSION_GROUPS.map(group => (
            <Col xs={24} sm={12} md={8} key={group.key}>
              <Card
                size="small"
                title={<Text strong>{group.label}</Text>}
                styles={{ body: { padding: '8px 12px' } }}
              >
                {group.permissions.map(perm => (
                  <Row key={perm.field} justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                    <Col><Text>{perm.label}</Text></Col>
                    <Col>
                      <Switch
                        checked={permValues[perm.field] || false}
                        disabled={isLilei}
                        onChange={(checked) => {
                          setPermValues(prev => ({ ...prev, [perm.field]: checked }));
                        }}
                      />
                    </Col>
                  </Row>
                ))}
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  };

  // ========== 角色权限模板 ==========
  const ROLE_PERM_TEMPLATES_KEY = 'role_perm_templates';

  // 默认权限模板
  const defaultRoleTemplates: Record<string, Record<string, boolean>> = {
    admin: Object.fromEntries(ALL_PERM_FIELDS.map(f => [f, true])),
    teacher: Object.fromEntries(ALL_PERM_FIELDS.map(f => [f, ['permCourseView', 'permCourseCreate', 'permCourseEdit', 'permMemberView', 'permTeacherView', 'permPaymentView', 'permConsumeView', 'permLogView'].includes(f)])),
    user: Object.fromEntries(ALL_PERM_FIELDS.map(f => [f, ['permCourseView', 'permMemberView'].includes(f)])),
  };

  // 加载/保存角色模板
  const loadRoleTemplates = (): Record<string, Record<string, boolean>> => {
    try {
      const saved = localStorage.getItem(ROLE_PERM_TEMPLATES_KEY);
      return saved ? JSON.parse(saved) : defaultRoleTemplates;
    } catch {
      return defaultRoleTemplates;
    }
  };

  const saveRoleTemplates = (templates: Record<string, Record<string, boolean>>) => {
    localStorage.setItem(ROLE_PERM_TEMPLATES_KEY, JSON.stringify(templates));
  };

  const [roleTemplates, setRoleTemplates] = useState<Record<string, Record<string, boolean>>>(() => {
    if (typeof window !== 'undefined') return loadRoleTemplates();
    return defaultRoleTemplates;
  });

  // 编辑角色权限弹窗
  const [rolePermModalOpen, setRolePermModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingRolePerms, setEditingRolePerms] = useState<Record<string, boolean>>({});

  const openRolePermEdit = (roleKey: string) => {
    setEditingRole(roleKey);
    const templates = loadRoleTemplates();
    setEditingRolePerms({ ...(templates[roleKey] || {}) });
    setRolePermModalOpen(true);
  };

  const handleSaveRolePerms = () => {
    if (!editingRole) return;
    const templates = loadRoleTemplates();
    templates[editingRole] = { ...editingRolePerms };
    saveRoleTemplates(templates);
    setRoleTemplates(templates);
    setRolePermModalOpen(false);
    setEditingRole(null);
    message.success(`「${ROLE_OPTIONS.find(r => r.value === editingRole)?.label || editingRole}」权限模板已更新`);
  };

  const handleResetRolePerms = (roleKey: string) => {
    const templates = loadRoleTemplates();
    templates[roleKey] = { ...defaultRoleTemplates[roleKey] };
    saveRoleTemplates(templates);
    setRoleTemplates(templates);
    setEditingRolePerms({ ...defaultRoleTemplates[roleKey] });
    message.success(`「${ROLE_OPTIONS.find(r => r.value === roleKey)?.label || roleKey}」权限已恢复默认`);
  };

  // 获取角色权限详情文本
  const getRolePermSummary = (roleKey: string) => {
    const template = loadRoleTemplates()[roleKey];
    if (!template) return '未配置';
    const enabled = Object.entries(template).filter(([, v]) => v).length;
    const total = Object.keys(template).length;
    return `${enabled}/${total} 项`;
  };

  // 角色管理内容
  const rolesContent = (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card
            actions={[
              <Button type="link" icon={<EditOutlined />} onClick={() => openRolePermEdit('admin')}>编辑权限</Button>,
            ]}
          >
            <Statistic
              title="管理员"
              value={adminCount}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#F72A8A' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>权限: {getRolePermSummary('admin')}</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            actions={[
              <Button type="link" icon={<EditOutlined />} onClick={() => openRolePermEdit('teacher')}>编辑权限</Button>,
            ]}
          >
            <Statistic
              title="教师"
              value={teacherCount}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#3B82F6' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>权限: {getRolePermSummary('teacher')}</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            actions={[
              <Button type="link" icon={<EditOutlined />} onClick={() => openRolePermEdit('user')}>编辑权限</Button>,
            ]}
          >
            <Statistic
              title="普通用户"
              value={userCount}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#22C55E' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>权限: {getRolePermSummary('user')}</Text>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }}>
        <Title level={5}>角色说明</Title>
        <Table
          rowKey="role"
          size="middle"
          pagination={false}
          dataSource={[
            { role: '超级管理员', name: 'lilei', description: '系统超级管理员，拥有所有权限，不可删除、不可禁用', count: 1, color: 'red' },
            { role: '管理员', name: 'admin', description: '后台全面管理权限，可分配除系统管理外的所有功能', count: adminCount, color: 'red' },
            { role: '教师', name: 'teacher', description: '课程管理与学员数据查看，可分配部分管理权限', count: teacherCount, color: 'blue' },
            { role: '普通用户', name: 'user', description: '受限访问，仅查看分配的权限范围', count: userCount, color: 'green' },
          ]}
          columns={[
            { title: '角色', dataIndex: 'role', width: 130, render: (val: string, record: any) => <Tag color={record.color}>{val}</Tag> },
            { title: '角色标识', dataIndex: 'name', width: 120 },
            { title: '说明', dataIndex: 'description' },
            { title: '人数', dataIndex: 'count', width: 80, render: (val: number) => <Badge count={val} style={{ backgroundColor: '#F72A8A' }} /> },
          ]}
        />
      </Card>

      {/* 角色权限编辑弹窗 */}
      <Modal
        title={`编辑角色权限 - ${editingRole ? (ROLE_OPTIONS.find(r => r.value === editingRole)?.label || editingRole) : ''}`}
        open={rolePermModalOpen}
        onOk={handleSaveRolePerms}
        onCancel={() => { setRolePermModalOpen(false); setEditingRole(null); }}
        width={800}
        okText="保存权限模板"
        cancelText="取消"
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">
            编辑角色默认权限模板。新建用户时选择此角色，将自动应用以下权限。
            已有用户的权限不受影响。
          </Text>
          <Button
            type="link"
            danger
            size="small"
            style={{ marginLeft: 16 }}
            onClick={() => editingRole && handleResetRolePerms(editingRole)}
          >
            重置为默认
          </Button>
        </div>
        <Row gutter={[16, 16]}>
          {PERMISSION_GROUPS.map(group => (
            <Col xs={24} sm={12} md={8} key={group.key}>
              <Card
                size="small"
                title={<Text strong>{group.label}</Text>}
                styles={{ body: { padding: '8px 12px' } }}
              >
                {group.permissions.map(perm => (
                  <Row key={perm.field} justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                    <Col><Text>{perm.label}</Text></Col>
                    <Col>
                      <Switch
                        checked={editingRolePerms[perm.field] || false}
                        onChange={(checked) => {
                          setEditingRolePerms(prev => ({ ...prev, [perm.field]: checked }));
                        }}
                      />
                    </Col>
                  </Row>
                ))}
              </Card>
            </Col>
          ))}
        </Row>
      </Modal>
    </div>
  );

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={2}>权限管理</Title>
            <Text type="secondary">管理后台用户与权限配置</Text>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增用户
            </Button>
          </Col>
        </Row>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card><Statistic title="总用户" value={users.length} prefix={<UserOutlined />} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="启用" value={activeCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#22C55E' }} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="管理员" value={adminCount} prefix={<SafetyOutlined />} valueStyle={{ color: '#F72A8A' }} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="教师" value={teacherCount} prefix={<TeamOutlined />} valueStyle={{ color: '#3B82F6' }} />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'users',
            label: `用户管理 (${users.length})`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table
                  scroll={{ x: 'max-content' }}
                  rowKey="id"
                  size="middle"
                  dataSource={users}
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total: number) => `共 ${total} 个用户` }}
                  locale={{ emptyText: <Empty description="暂无用户数据，点击右上角新增用户" /> }}
                  columns={userColumns}
                />
              </Card>
            ),
          },
          {
            key: 'roles',
            label: '角色管理',
            children: rolesContent,
          },
        ]}
      />

      {/* 新建/编辑用户弹窗 */}
      <Modal
        title={modalMode === 'create' ? '新增用户' : `编辑用户 - ${editingUser?.name || ''}`}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={modalLoading}
        width={modalMode === 'edit' && showPermSettings ? 900 : 520}
        okText={modalMode === 'create' ? '创建' : '保存'}
        cancelText="取消"
      >
        <Form
          form={userForm}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="用户名"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 2, message: '用户名至少2个字符' },
                  { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' },
                ]}
              >
                <Input
                  placeholder="请输入用户名"
                  disabled={editingUser?.username === 'lilei'}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="password"
                label={modalMode === 'create' ? '密码' : '密码（留空不修改）'}
                rules={modalMode === 'create'
                  ? [{ required: true, message: '请输入密码' }, { min: 4, message: '密码至少4个字符' }]
                  : []
                }
              >
                <Input.Password
                  placeholder={modalMode === 'create' ? '请输入密码' : '留空则不修改密码'}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="role"
                label="角色"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select options={ROLE_OPTIONS} placeholder="请选择角色" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select options={STATUS_OPTIONS} placeholder="请选择状态" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {/* 编辑模式下显示权限设置展开区域 */}
        {modalMode === 'edit' && (
          <div style={{ marginTop: 8 }}>
            <Button
              type="link"
              onClick={() => setShowPermSettings(!showPermSettings)}
            >
              {showPermSettings ? '收起权限设置 ▲' : '展开权限设置 ▼'}
            </Button>
            {showPermSettings && renderPermissionSwitches()}
          </div>
        )}
      </Modal>
    </div>
  );
}
