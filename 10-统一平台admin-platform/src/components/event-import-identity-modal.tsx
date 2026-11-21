'use client';

import { useState } from 'react';
import { Alert, Button, Modal, Select, Space } from 'antd';
import type { ImportIdentityConflict, ImportIdentityDecision } from '@/lib/event-import-identity';

export default function EventImportIdentityModal({ conflicts, onCancel, onComplete }: {
  conflicts: ImportIdentityConflict[];
  onCancel: () => void;
  onComplete: (decisions: ImportIdentityDecision[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<'identity' | 'merge'>('identity');
  const [targetId, setTargetId] = useState<number>();
  const [decisions, setDecisions] = useState<ImportIdentityDecision[]>([]);
  const conflict = conflicts[index];
  if (!conflict) return null;
  const finish = (decision: ImportIdentityDecision) => {
    const next = [...decisions, decision];
    if (index + 1 === conflicts.length) onComplete(next);
    else { setDecisions(next); setIndex(index + 1); setStep('identity'); setTargetId(undefined); }
  };
  const blocked = conflict.unavailable || (conflict.candidates.length > 1 && !conflict.canMerge);
  return <Modal open title={step === 'identity' ? '确认是否为同一人' : '确认合并人员档案'} onCancel={onCancel} maskClosable={false} width={560}
    footer={<Space wrap>
      <Button onClick={onCancel}>暂不处理，返回导入</Button>
      {step === 'identity' ? <>
        <Button onClick={() => finish({ key: conflict.key, action: 'skip' })}>否，跳过此人</Button>
        <Button type="primary" disabled={blocked} onClick={() => { setTargetId(conflict.candidates[0]?.id); setStep('merge'); }}>是，下一步</Button>
      </> : <>
        <Button onClick={() => setStep('identity')}>返回核对</Button>
        <Button type="primary" danger={conflict.candidates.length > 1} disabled={!targetId} onClick={() => finish({ key: conflict.key, action: conflict.candidates.length > 1 ? 'merge' : 'same', targetId })}>
          {conflict.candidates.length > 1 ? '确认合并并继续导入' : '确认使用已有档案并导入'}
        </Button>
      </>}
    </Space>}>
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>第 {index + 1} / {conflicts.length} 位待确认 · Excel 第 {conflict.rows.join('、')} 行</div>
      <div>新导入姓名：<strong>{conflict.name}</strong><br />联系电话：{conflict.phone}</div>
      <div>该号码关联的已有人员：<ul>{conflict.candidates.map(member => <li key={member.id}>{member.name}（档案 {member.id}）</li>)}</ul></div>
      {blocked ? <Alert type="warning" showIcon message="请联系平台管理员核对并合并" description="当前账号无权合并这些全局人员档案。可跳过此人，继续导入其他选手。" />
        : step === 'identity' ? <Alert type="info" showIcon message="新导入姓名与以上所有档案，是否属于同一个人？" description={`同一姓名、同一号码的 ${conflict.rows.length} 行一起处理；选择“否”后，这些行不导入，原档案保持不变。`} />
          : <>
            {conflict.candidates.length > 1 && <label>保留的主档案
              <Select aria-label="保留的主档案" style={{ width: '100%', marginTop: 8 }} value={targetId} onChange={setTargetId} options={conflict.candidates.map(member => ({ value: member.id, label: `${member.name}（档案 ${member.id}）` }))} />
            </label>}
            <Alert type="warning" showIcon message={conflict.candidates.length > 1 ? '确认后合并到所选主档案，并继续导入' : '确认后使用已有档案，不新建重复人员'} description={`${conflict.candidates.length > 1 ? `合并后人员姓名默认更新为“${conflict.name}”。` : ''}原有报名、缴费、成绩和课程授权会保留。身份或数据冲突时会停止处理。全部待确认人员处理完毕后才开始保存。`} />
          </>}
    </Space>
  </Modal>;
}
