'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Input } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { apiError } from '@/lib/online-course-ui';
import styles from './inline-lesson-name.module.css';

export function InlineLessonName({ name, displayName, disabled, onSave, onEditingChange }: {
  name: string;
  displayName: string;
  disabled?: boolean;
  onSave: (name: string) => Promise<void>;
  onEditingChange: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const composing = useRef(false);
  const active = useRef(false);
  const notify = useRef(onEditingChange);
  notify.current = onEditingChange;
  useEffect(() => () => { if (active.current) notify.current(false); }, []);

  const finish = () => {
    active.current = false;
    setEditing(false);
    setError('');
    notify.current(false);
  };
  const save = async () => {
    if (!active.current || busy.current || composing.current) return;
    const next = draft.trim();
    if (!next) { setError('课节名称不能为空'); return; }
    if (next === name) { finish(); return; }
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(next);
      finish();
    } catch (err) {
      setError(apiError(err) || '保存失败，请重试');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <div className={styles.cell} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) void save();
    }}>
      {editing ? <div className={styles.editor}>
        <div className={styles.controls}>
          <Input
            autoFocus
            aria-label="修改课节名称"
            size="small"
            value={draft}
            disabled={saving}
            status={error ? 'error' : undefined}
            onFocus={event => event.target.select()}
            onChange={event => { setDraft(event.target.value); setError(''); }}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={event => {
              if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return;
              if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); void save(); }
              if (event.key === 'Escape' && !busy.current) { event.preventDefault(); event.stopPropagation(); finish(); }
            }}
          />
          <Button size="small" type="text" aria-label="确认课节名称" title="确认保存" icon={<CheckOutlined />} loading={saving}
            onMouseDown={event => event.preventDefault()} onClick={() => void save()} />
          <Button size="small" type="text" aria-label="取消修改课节名称" title="取消（Esc）" icon={<CloseOutlined />} disabled={saving}
            onMouseDown={event => event.preventDefault()} onClick={finish} />
        </div>
        {error && <div role="alert" className={styles.error}>{error}</div>}
      </div> : <>
        <strong className={styles.name}>{displayName}</strong>
        <Button type="text" size="small" className={styles.editButton} icon={<EditOutlined />} disabled={disabled}
          aria-label={`修改课节名称：${name}`} title="修改课节名称"
          onClick={() => {
            setDraft(name); setError(''); setEditing(true); active.current = true; notify.current(true);
          }} />
      </>}
    </div>
  );
}
