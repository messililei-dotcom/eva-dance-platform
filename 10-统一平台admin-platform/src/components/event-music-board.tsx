'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { App, Button, Empty, Tag } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import EventMusicPlayer from './event-music-player';
import { lessonDropPosition, type DropTarget } from '@/lib/lesson-drag-sort';
import { api } from '@/lib/api';
import styles from './event-music-board.module.css';

type Group = { id: number; name: string; sortOrder?: number };
type Player = {
  id: number; groupId: number; name: string; status: string; auditStatus: string;
  sequenceNo: number; playerNo: string; performanceTitle: string; musicFileId: number;
};
type DragItem = { groupId: number; playerId?: number };

const sequence = (player: Player) => player.sequenceNo > 0 ? player.sequenceNo : Infinity;

export default function EventMusicBoard({ competitionId, groups, players, active, busy, onRefresh, onMoveGroup }: {
  competitionId: number;
  groups: Group[];
  players: Player[];
  active: boolean;
  busy: boolean;
  onRefresh: () => Promise<void>;
  onMoveGroup: (id: number, position: number) => Promise<void>;
}) {
  const { message } = App.useApp();
  const board = useRef<HTMLDivElement>(null);
  const saving = useRef(false);
  const dragBlocked = useRef(false);
  const [downloading, setDownloading] = useState(false);
  const [pending, setPending] = useState(false);
  const [played, setPlayed] = useState<Record<number, number>>({});
  const [target, setTarget] = useState<(DropTarget & { axis: 'x' | 'y' }) | null>(null);
  const [drag, setDrag] = useState<DragItem | null>(null);
  const sections = useMemo(() => {
    const entries = new Map<number, Player[]>();
    for (const player of players) {
      if (['cancelled', 'withdrawn'].includes(player.status) || player.auditStatus === 'rejected') continue;
      if (!entries.has(player.groupId)) entries.set(player.groupId, []);
      entries.get(player.groupId)!.push(player);
    }
    const orderedGroups = [...groups].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.id - b.id);
    return orderedGroups.flatMap((group, index) => {
      const rows = entries.get(group.id);
      return rows?.length ? [{ group, position: index + 1, rows: rows.sort((a, b) => (sequence(a) - sequence(b)) || a.id - b.id) }] : [];
    });
  }, [groups, players]);

  useEffect(() => {
    if (!active) {
      board.current?.querySelectorAll('audio').forEach(audio => audio.pause());
      setDrag(null);
      setTarget(null);
    }
  }, [active]);

  const disabled = busy || pending;
  const endDrag = () => { setDrag(null); setTarget(null); };
  const movePlayer = async (groupId: number, rows: Player[], from: number, to: number) => {
    if (disabled || saving.current || from < 0 || to < 0 || to >= rows.length || from === to) return;
    const previousIds = rows.map(row => row.id);
    const ids = [...previousIds];
    ids.splice(to, 0, ...ids.splice(from, 1));
    saving.current = true;
    setPending(true);
    try {
      await api.post('/event/performances/reorder', { competitionId, groupId, previousIds, ids });
      message.success('出场顺序已保存');
    } catch (error: any) {
      message.error(error?.response?.data?.error || '排序保存失败，请重试');
    } finally {
      await onRefresh();
      saving.current = false;
      setPending(false);
    }
  };

  const downloadMusic = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await api.get('/event/competitions/' + competitionId + '/music-download', {
        responseType: 'blob', timeout: 300000,
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      const disposition = response.headers['content-disposition'] || '';
      const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
      link.href = url;
      link.download = encoded ? decodeURIComponent(encoded) : '赛事全部音乐.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      message.success('音乐包已生成，已开始下载');
    } catch (error: any) {
      let detail = error?.response?.data?.error || error?.message || '音乐下载失败，请重试';
      if (error?.response?.data instanceof Blob) {
        try { detail = JSON.parse(await error.response.data.text()).error || detail; } catch { /* Keep the transport error. */ }
      }
      message.error(detail);
    } finally {
      setDownloading(false);
    }
  };

  const groupTarget = (event: DragEvent<HTMLElement>, id: number) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { id, edge: event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after', axis: 'y' } as const;
  };

  const playerTarget = (event: DragEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const axis = getComputedStyle(container).gridTemplateColumns.split(' ').length > 1 ? 'x' : 'y';
    const cards = Array.from(container.querySelectorAll<HTMLElement>('article[data-player-id]'));
    let closest: HTMLElement | undefined;
    let distance = Infinity;
    for (const card of cards) {
      const bounds = card.getBoundingClientRect();
      const dx = Math.max(bounds.left - event.clientX, 0, event.clientX - bounds.right);
      const dy = Math.max(bounds.top - event.clientY, 0, event.clientY - bounds.bottom);
      const nextDistance = dx * dx + dy * dy;
      if (nextDistance < distance) { closest = card; distance = nextDistance; }
    }
    if (!closest) return null;
    const bounds = closest.getBoundingClientRect();
    const before = axis === 'x' ? event.clientX < bounds.left + bounds.width / 2 : event.clientY < bounds.top + bounds.height / 2;
    return { id: Number(closest.dataset.playerId), edge: before ? 'before' : 'after', axis } as const;
  };

  return <div ref={board} className={styles.board}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null); }}>
    <div className={styles.toolbar}>
      <p className={styles.hint}>按住卡片空白处拖动节目，按住组别名称拖动整组。</p>
      <Button className={styles.downloadAll} icon={<DownloadOutlined />} loading={downloading} disabled={busy || pending || !players.some(player => player.musicFileId > 0)}
        onClick={() => void downloadMusic()}>下载全部音乐</Button>
    </div>
    {!sections.length && <Empty description="暂无可编排的报名" />}
    {sections.map(({ group, rows, position }, groupIndex) => (
      <section key={group.id} className={styles.group} data-tone={groupIndex % 4}
        data-drop-edge={drag && drag.playerId === undefined && drag.groupId !== group.id && target?.id === group.id ? target.edge : undefined}
        onDragOver={event => {
          if (disabled || !drag || drag.playerId !== undefined) return;
          event.preventDefault();
          setTarget(groupTarget(event, group.id));
        }}
        onDrop={event => {
          if (!drag || drag.playerId !== undefined || disabled) return;
          event.preventDefault();
          const position = lessonDropPosition(groups.map(item => item.id), drag.groupId, groupTarget(event, group.id));
          if (position > 0) void onMoveGroup(drag.groupId, position);
          endDrag();
        }}>
        <div className={styles.cards}
          onDragOver={event => {
            if (disabled || drag?.groupId !== group.id || drag.playerId === undefined) return;
            event.preventDefault();
            event.stopPropagation();
            setTarget(playerTarget(event));
          }}
          onDrop={event => {
            if (disabled || drag?.groupId !== group.id || drag.playerId === undefined) return;
            event.preventDefault();
            event.stopPropagation();
            const destination = playerTarget(event);
            if (destination) {
              const position = lessonDropPosition(rows.map(row => row.id), drag.playerId, destination);
              void movePlayer(group.id, rows, rows.findIndex(row => row.id === drag.playerId), position - 1);
            }
            endDrag();
          }}>
          {rows.map((player, index) => {
            const finished = player.musicFileId > 0 && played[player.id] === player.musicFileId;
            return <article key={player.id} className={styles.musicCard} data-played={finished} data-missing={!player.musicFileId}
              tabIndex={0}
              aria-keyshortcuts="Control+ArrowUp Control+ArrowDown"
              onKeyDown={event => {
                if (event.target !== event.currentTarget || !event.ctrlKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault();
                void movePlayer(group.id, rows, index, index + (event.key === 'ArrowUp' ? -1 : 1));
              }}
              draggable={!disabled && rows.length > 1}
              aria-label={`节目 ${player.name}，${player.performanceTitle || player.playerNo || '节目'}`}
              onMouseDownCapture={event => { dragBlocked.current = Boolean((event.target as Element).closest('button,audio,input')); }}
              onDragStart={event => {
                if (dragBlocked.current || disabled || rows.length < 2) { event.preventDefault(); return; }
                event.stopPropagation();
                event.dataTransfer.setData('text/plain', String(player.id));
                setDrag({ groupId: group.id, playerId: player.id });
              }}
              onDragEnd={endDrag}
              data-player-id={player.id}
              data-drop-axis={target?.axis}
              data-drop-edge={drag?.groupId === group.id && drag.playerId !== undefined && drag.playerId !== player.id && target?.id === player.id ? target.edge : undefined}>
              <div className={styles.groupHeading}>
                <span className={styles.groupName} title={`顺序序号 ${position} · ${group.name}`}
                  data-group-order={position}
                  data-group-drag={group.id}
                  draggable={!disabled && sections.length > 1}
                  tabIndex={disabled ? -1 : 0}
                  aria-label={`拖动组别 ${group.name}`}
                  aria-keyshortcuts="Control+ArrowUp Control+ArrowDown"
                  onKeyDown={event => {
                    if (!event.ctrlKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (disabled) return;
                    const neighbor = sections[groupIndex + (event.key === 'ArrowUp' ? -1 : 1)];
                    if (neighbor) void onMoveGroup(group.id, neighbor.position);
                  }}
                  onDragStart={event => {
                    event.stopPropagation();
                    if (disabled || sections.length < 2) { event.preventDefault(); return; }
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(group.id));
                    setDrag({ groupId: group.id });
                  }} onDragEnd={event => { event.stopPropagation(); endDrag(); }}><span className={styles.groupOrder}>{position}</span>{group.name}</span>
                {finished && <Tag className={styles.finished} color="success">已播完</Tag>}
              </div>
              <div className={styles.cardHeading}>
                <strong className={styles.sequence} data-unset={!(player.sequenceNo > 0)}>{player.sequenceNo > 0 ? `第 ${player.sequenceNo} 位` : '未排序'}</strong>
                <span className={styles.program} title={`${player.name} · ${player.performanceTitle || player.playerNo || '节目'}`}>
                  <span className={styles.playerName}>{player.name}</span>
                  <span className={styles.programTitle}>{player.performanceTitle || player.playerNo || '节目'}</span>
                </span>
              </div>
              <EventMusicPlayer player={player} preload="none" cardLayout onUploaded={() => void onRefresh()}
                onEnded={musicFileId => setPlayed(current => ({ ...current, [player.id]: musicFileId }))} />
            </article>;
          })}
        </div>
      </section>
    ))}
  </div>;
}
