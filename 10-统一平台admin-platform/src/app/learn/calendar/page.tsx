'use client';

import { useEffect, useState } from 'react';
import { Card, Tag, Space, Typography, Row, Col, Button, Segmented, Spin, Empty, Divider } from 'antd';
import { LeftOutlined, RightOutlined, EnvironmentOutlined, UserOutlined, TeamOutlined, CalendarOutlined, TrophyOutlined, VideoCameraOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const BRAND = { text: '#8B1A1A', gold: '#C8A96E', goldDark: '#B89445', muted: '#999' };

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

const EVENT_COLORS: Record<string, string> = {
  online: '#1677ff',
  offline: '#52c41a',
  event: '#a855f7',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  online: '线上课程',
  offline: '线下培训',
  event: '赛事活动',
};

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];
  
  // 填充月初空白
  for (let i = 0; i < firstDay.getDay(); i++) {
    const prevDate = new Date(year, month - 1, -i);
    days.unshift({ date: dayjs(prevDate).format('YYYY-MM-DD'), day: prevDate.getDate(), isCurrentMonth: false });
  }
  // 按顺序
  days.sort((a, b) => a.date.localeCompare(b.date));
  
  // 填充当月天数
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ date, day: d, isCurrentMonth: true });
  }
  
  // 补全最后一周
  while (days.length % 7 !== 0) {
    const lastDate = days[days.length - 1];
    const nextDate = dayjs(lastDate.date).add(1, 'day').format('YYYY-MM-DD');
    days.push({ date: nextDate, day: parseInt(nextDate.split('-')[2]), isCurrentMonth: false });
  }
  
  return days;
}

export default function CalendarPage() {
  const now = dayjs();
  const [year, setYear] = useState(now.year());
  const [month, setMonth] = useState(now.month() + 1);
  const [events, setEvents] = useState<any[]>([]);
  const [byDate, setByDate] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    loadCalendar();
  }, [year, month]);

  async function loadCalendar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/mini/public/calendar?year=${year}&month=${month}`);
      const json = await res.json();
      if (json.success) {
        setEvents(json.data.events || []);
        setByDate(json.data.byDate || {});
      }
    } catch (err) {
      console.error('加载日历失败', err);
    } finally {
      setLoading(false);
    }
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  function today() {
    setYear(now.year());
    setMonth(now.month() + 1);
  }

  const monthDays = getMonthDays(year, month);

  const eventCount = (date: string) => (byDate[date] || []).length;

  const typeColors: Record<string, string> = {
    online: '#e6f4ff',
    offline: '#f6ffed',
    event: '#f9f0ff',
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Title level={4} style={{ margin: 0, color: BRAND.text }}>
            <CalendarOutlined style={{ marginRight: 8 }} />课程日历
          </Title>
          <Tag color="blue">{year}年{month}月</Tag>
        </Space>
        <Space>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as 'calendar' | 'list')}
            options={[
              { label: '📅 月视图', value: 'calendar' },
              { label: '📋 列表', value: 'list' },
            ]}
          />
        </Space>
      </div>

      {/* Month Navigation */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row align="middle" justify="space-between">
          <Button icon={<LeftOutlined />} onClick={prevMonth} type="text" />
          <Space>
            <Button size="small" onClick={today} style={{ borderRadius: 4 }}>今天</Button>
            <Text strong style={{ fontSize: 16, minWidth: 120, textAlign: 'center', display: 'inline-block' }}>
              {year}年{month}月
            </Text>
          </Space>
          <Button icon={<RightOutlined />} onClick={nextMonth} type="text" />
        </Row>
      </Card>

      {/* Legend */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 16, fontSize: 13, color: '#666' }}>
        <span><span style={{ color: EVENT_COLORS.online }}>●</span> 线上课程</span>
        <span><span style={{ color: EVENT_COLORS.offline }}>●</span> 线下培训</span>
        <span><span style={{ color: EVENT_COLORS.event }}>●</span> 赛事活动</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : viewMode === 'calendar' ? (
        /* Calendar Grid */
        <Card style={{ borderRadius: 8, overflow: 'hidden' }} bodyStyle={{ padding: 0 }}>
          {/* Weekday headers */}
          <Row gutter={0} style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
            {WEEK_DAYS.map(d => (
              <Col key={d} span={24 / 7} style={{ textAlign: 'center', padding: '10px 4px', fontWeight: 600, fontSize: 13, color: '#666' }}>
                {d}
              </Col>
            ))}
          </Row>
          {/* Day cells */}
          <Row gutter={0}>
            {monthDays.map((day, i) => {
              const count = eventCount(day.date);
              const isToday = day.date === now.format('YYYY-MM-DD');
              const isSelected = day.date === selectedDate;
              const hasEvents = count > 0;
              const dayEvents = byDate[day.date] || [];
              const isExpanded = day.date === expandedDate;

              return (
                <Col key={i} span={24 / 7} style={{
                  minHeight: 80,
                  borderRight: (i + 1) % 7 !== 0 ? '1px solid #f0f0f0' : 'none',
                  borderBottom: '1px solid #f0f0f0',
                  background: isSelected ? '#fff7e6' : (isToday ? '#fffbe6' : (day.isCurrentMonth ? '#fff' : '#fafafa')),
                  padding: 4,
                  cursor: hasEvents ? 'pointer' : 'default',
                  position: 'relative',
                }} onClick={() => hasEvents && setExpandedDate(isExpanded ? null : day.date)}>
                  <div style={{
                    textAlign: 'center',
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? BRAND.text : (day.isCurrentMonth ? '#333' : '#ccc'),
                    fontSize: 13,
                    marginBottom: 2,
                  }}>
                    {day.day}
                  </div>
                  {hasEvents && (
                    <div style={{ textAlign: 'center' }}>
                      {count <= 3 ? dayEvents.slice(0, 3).map((e: any, ei: number) => (
                        <div key={ei} style={{
                          fontSize: 10, padding: '1px 3px', marginBottom: 1,
                          borderRadius: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          background: typeColors[e.type] || '#f0f0f0',
                          color: EVENT_COLORS[e.type] || '#666',
                        }}>{e.title.slice(0, 8)}</div>
                      )) : (
                        <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px' }}>{count}项</Tag>
                      )}
                    </div>
                  )}

                  {/* Expanded detail */}
                  {isExpanded && hasEvents && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                      background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 8, minWidth: 200,
                    }}>
                      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                        {day.date}
                      </Text>
                      {dayEvents.map((e: any, ei: number) => (
                        <div key={ei} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>
                          <Tag color={EVENT_COLORS[e.type]} style={{ fontSize: 10, marginRight: 4 }}>
                            {EVENT_TYPE_LABELS[e.type]}
                          </Tag>
                          <Text strong style={{ fontSize: 12 }}>{e.title}</Text>
                          {e.subtitle && <div><Text type="secondary" style={{ fontSize: 11 }}>{e.subtitle}</Text></div>}
                          {e.location && <div><Text type="secondary" style={{ fontSize: 11 }}><EnvironmentOutlined /> {e.location}</Text></div>}
                          {e.teacher && <div><Text type="secondary" style={{ fontSize: 11 }}><UserOutlined /> {e.teacher}</Text></div>}
                        </div>
                      ))}
                    </div>
                  )}
                </Col>
              );
            })}
          </Row>
        </Card>
      ) : (
        /* List View */
        <Card style={{ borderRadius: 8 }}>
          {events.length === 0 ? (
            <Empty description="本月暂无课程安排" />
          ) : (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {events.map((event: any) => (
                <Card key={event.id} size="small" hoverable style={{ borderRadius: 8, borderLeft: `4px solid ${EVENT_COLORS[event.type] || '#ddd'}` }}>
                  <Row align="middle" gutter={12}>
                    <Col flex="60px" style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: BRAND.text }}>
                        {dayjs(event.date).format('DD')}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {dayjs(event.date).format('MM月')}
                      </Text>
                    </Col>
                    <Col flex="auto">
                      <Space>
                        <Tag color={EVENT_COLORS[event.type]} style={{ borderRadius: 4 }}>
                          {EVENT_TYPE_LABELS[event.type]}
                        </Tag>
                        <Text strong>{event.title}</Text>
                      </Space>
                      {event.subtitle && <div><Text type="secondary" style={{ fontSize: 12 }}>{event.subtitle}</Text></div>}
                      <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                        {event.location && <span style={{ marginRight: 12 }}><EnvironmentOutlined /> {event.location}</span>}
                        {event.teacher && <span><UserOutlined /> {event.teacher}</span>}
                        {event.enrolled > 0 && <span style={{ marginLeft: 12 }}><TeamOutlined /> {event.enrolled}/{event.maxStudents}</span>}
                      </div>
                    </Col>
                    <Col>
                      {event.type === 'online' ? (
                        <Button type="link" size="small" icon={<VideoCameraOutlined />}>查看</Button>
                      ) : event.type === 'event' ? (
                        <Button type="link" size="small" icon={<TrophyOutlined />}>详情</Button>
                      ) : (
                        <Button type="link" size="small" icon={<DownloadOutlined />}>报名</Button>
                      )}
                    </Col>
                  </Row>
                </Card>
              ))}
            </Space>
          )}
        </Card>
      )}

      <Divider />
      <div style={{ textAlign: 'center', color: '#999', fontSize: 12, padding: '12px 0' }}>
        数据来源：伊娃东方舞数字化运营平台
      </div>
    </div>
  );
}
