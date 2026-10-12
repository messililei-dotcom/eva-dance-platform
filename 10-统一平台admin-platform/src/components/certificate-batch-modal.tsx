'use client';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Col, Input, message, Modal, Radio, Row, Select, Space, Tag, Typography } from 'antd';
import { Table } from '@/components/adaptive-table';
import { api } from '@/lib/api';
type Course = { id: number; name: string; subType?: string; templateId?: number; startDate?: string; endDate?: string };
type Student = { memberId: number; memberName: string; memberPhone: string; issued: boolean; certificateNo: string };
export default function CertificateBatchModal({ open, onClose, onIssued }: { open: boolean; onClose: () => void; onIssued: () => void }) {
  const [kind, setKind] = useState('offline');
  const [courses, setCourses] = useState<Course[]>([]);
  const [series, setSeries] = useState<Course[]>([]);
  const [courseKey, setCourseKey] = useState<string>();
  const [seriesId, setSeriesId] = useState<number>();
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const requestVersion = useRef(0);
  const keyOf = (c: Course) => c.templateId ? `template:${c.templateId}` : `name:${c.name}`;
  const resetRoster = () => { requestVersion.current++; setStudents([]); setSelected([]); setSearch(''); setLoading(false); };
  useEffect(() => {
    if (!open) { requestVersion.current++; return; }
    setKind('offline'); setCourseKey(undefined); setSeriesId(undefined); resetRoster();
    let cancelled = false; setOptionsLoading(true);
    Promise.all([api.get('/courses'), api.get('/course/series', { params: { all: 1, pageSize: 1000 } })]).then(([offline, online]) => {
      if (cancelled) return;
      setCourses(Array.isArray(offline.data) ? offline.data.filter((c: any) => Number(c.series_id || 0) <= 0) : []);
      setSeries(Array.isArray(online.data) ? online.data : online.data?.data || []);
    }).catch(e => { if (!cancelled) message.error(e?.response?.data?.error || '课程加载失败'); }).finally(() => { if (!cancelled) setOptionsLoading(false); });
    return () => { cancelled = true; };
  }, [open]);
  const loadRoster = async (id: number) => {
    resetRoster(); setSeriesId(id); setLoading(true); const version = ++requestVersion.current;
    try {
      const res = await api.get('/certificates/batch', { params: { seriesId: id } });
      if (version !== requestVersion.current) return;
      setStudents(res.data.data.students || []);
    } catch (e: any) { if (version === requestVersion.current) message.error(e?.response?.data?.error || '名单加载失败'); }
    finally { if (version === requestVersion.current) setLoading(false); }
  };
  const issue = async () => {
    if (!seriesId || !selected.length || issuing) return;
    setIssuing(true);
    try {
      const res = await api.post('/certificates/batch', { seriesId, memberIds: selected });
      message.success(`已颁发 ${res.data.data.issued} 份证书，跳过 ${res.data.data.skipped} 份已有证书`);
      onIssued(); await loadRoster(seriesId);
    } catch (e: any) { message.error(e?.response?.data?.error || '批量颁发失败'); }
    finally { setIssuing(false); }
  };
  const courseOptions = Array.from(new Map(courses.map(c => [keyOf(c), { value: keyOf(c), label: c.name }])).values());
  const periods = courses.filter(c => keyOf(c) === courseKey);
  const filtered = students.filter(s => `${s.memberName} ${s.memberPhone} ${s.memberId}`.toLowerCase().includes(search.toLowerCase()));
  const pending = students.filter(s => !s.issued);
  return <Modal title="按课程批量颁发证书" open={open} onCancel={() => { if (!issuing) onClose(); }} width={850} maskClosable={!issuing} closable={!issuing} footer={<Space><Button disabled={issuing} onClick={onClose}>关闭</Button><Button type="primary" loading={issuing} disabled={!selected.length || loading} onClick={issue}>颁发给已选 {selected.length} 位学员</Button></Space>} styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}>
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert type="info" showIcon message="选择课程后勾选学员颁发。已有有效证书自动跳过；证书使用课程模板，并通知学员在个人中心查看。" />
      <Radio.Group value={kind} disabled={issuing || optionsLoading} onChange={e => { setKind(e.target.value); setCourseKey(undefined); setSeriesId(undefined); resetRoster(); }} options={[{ value: 'offline', label: '线下课程' }, { value: 'online', label: '线上课程 / 成品舞' }]} />
      <Row gutter={[12, 12]}><Col xs={24} sm={kind === 'offline' ? 12 : 24}>
        <Typography.Text>课程</Typography.Text>
        <Select<string | number, { value: string | number; label: string }> style={{ width: '100%', marginTop: 6 }} loading={optionsLoading} disabled={issuing} showSearch optionFilterProp="label" placeholder="搜索并选择课程" value={kind === 'offline' ? courseKey : seriesId} options={kind === 'offline' ? courseOptions : series.map(c => ({ value: c.id, label: c.name }))} onChange={value => { if (kind === 'offline') { setCourseKey(String(value)); setSeriesId(undefined); resetRoster(); } else { void loadRoster(Number(value)); } }} />
      </Col>{kind === 'offline' && <Col xs={24} sm={12}><Typography.Text>期次</Typography.Text><Select style={{ width: '100%', marginTop: 6 }} disabled={!courseKey || issuing} showSearch optionFilterProp="label" placeholder="选择具体期次" value={seriesId} options={periods.map(c => ({ value: -Math.abs(c.id), label: `${c.subType || '未标记期次'}${c.startDate ? ` · ${c.startDate}${c.endDate ? ' 至 ' + c.endDate : ''}` : ''} · #${c.id}` }))} onChange={value => { void loadRoster(value); }} /></Col>}</Row>
      <Space wrap><Typography.Text>本课程 {students.length} 位学员 · 已颁发 {students.length - pending.length} 位 · 待颁发 {pending.length} 位</Typography.Text><Button disabled={!pending.length || issuing || loading} onClick={() => setSelected(pending.map(s => s.memberId))}>选择全部待颁发</Button><Button disabled={!selected.length || issuing} onClick={() => setSelected([])}>清空选择</Button></Space>
      <Input disabled={issuing} placeholder="搜索学员姓名 / 手机号 / member_id" value={search} onChange={e => setSearch(e.target.value)} allowClear />
      <Table<Student> size="small" rowKey="memberId" loading={loading} dataSource={filtered} locale={{ emptyText: seriesId ? '本课程或期次暂无可颁发学员' : '请先选择课程及期次' }} pagination={{ pageSize: 10 }} scroll={{ x: 620, y: 300 }} rowSelection={{ selectedRowKeys: selected, onChange: keys => setSelected(keys.map(Number)), getCheckboxProps: s => ({ disabled: s.issued || issuing }), preserveSelectedRowKeys: true }} columns={[{ title: '学员', dataIndex: 'memberName' }, { title: '手机号', dataIndex: 'memberPhone' }, { title: '证书状态', render: (_, s) => s.issued ? <Tag color="green">已颁发</Tag> : <Tag>待颁发</Tag> }, { title: '证书编号', dataIndex: 'certificateNo' }]} />
      <Typography.Text type="secondary">线下名单来自所选期次的有效报名记录，线上名单来自有效课程授权。批量手动颁发由管理员确认结业资格。</Typography.Text>
    </Space>
  </Modal>;
}
