'use client';

import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

// 简化的学员分布数据
const studentData = [
  { name: '湖南', value: 35 },
  { name: '北京', value: 12 },
  { name: '上海', value: 8 },
  { name: '广东', value: 6 },
  { name: '浙江', value: 5 },
  { name: '四川', value: 4 },
  { name: '江苏', value: 3 },
  { name: '湖北', value: 3 },
  { name: '山东', value: 2 },
  { name: '河南', value: 2 },
  { name: '重庆', value: 2 },
  { name: '福建', value: 1 },
  { name: '陕西', value: 1 },
  { name: '辽宁', value: 1 },
];

interface ChinaMapFixedProps {
  className?: string;
}

export default function ChinaMapFixed({ className }: ChinaMapFixedProps) {
  const [mapData, setMapData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 从本地加载GeoJSON数据
    fetch('/data/china-map.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`加载失败: HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setMapData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('地图数据加载失败:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className={`w-full h-[450px] flex items-center justify-center bg-[#1a1a2e] rounded-lg ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-4"></div>
          <p className="text-white/70">正在加载地图...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full h-[450px] flex items-center justify-center bg-[#1a1a2e] rounded-lg border border-red-500/30 ${className}`}>
        <div className="text-center">
          <div className="text-red-400 mb-2">⚠️ {error}</div>
          <p className="text-white/50 text-sm">请检查网络连接后刷新页面</p>
        </div>
      </div>
    );
  }

  // ECharts配置
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      borderColor: '#C8A96E',
      borderWidth: 1,
      textStyle: {
        color: '#fff',
        fontSize: 14,
      },
      formatter: (params: any) => {
        if (params.data) {
          return `<div style="padding:12px;">
            <div style="font-size:16px;font-weight:bold;color:#C8A96E;margin-bottom:8px;">${params.name}</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="color:#fff;">学员数量：</span>
              <span style="font-size:18px;font-weight:bold;color:#C8A96E;">${params.data.value}人</span>
            </div>
          </div>`;
        }
        return params.name || '';
      },
    },
    visualMap: {
      min: 0,
      max: 40,
      left: 'left',
      top: 'bottom',
      text: ['高', '低'],
      textStyle: {
        color: '#fff',
      },
      inRange: {
        color: ['#1a1a2e', '#16213e', '#C8A96E', '#E8D5B7', '#FFD700'],
      },
      calculable: true,
    },
    geo: {
      map: 'china',
      roam: true,
      zoom: 1.2,
      center: [104, 36],
      label: {
        show: true,
        color: '#fff',
        fontSize: 10,
      },
      emphasis: {
        label: {
          show: true,
          color: '#fff',
          fontWeight: 'bold',
          fontSize: 12,
        },
        itemStyle: {
          areaColor: '#C8A96E',
          borderColor: '#fff',
          borderWidth: 2,
        },
      },
      itemStyle: {
        areaColor: '#16213e',
        borderColor: '#C8A96E',
        borderWidth: 1,
      },
    },
    series: [
      {
        name: '学员分布',
        type: 'map',
        map: 'china',
        geoIndex: 0,
        data: studentData,
        label: {
          show: true,
          formatter: '{b}\n{c}人',
          position: 'inside',
          color: '#fff',
          fontSize: 10,
        },
        emphasis: {
          label: {
            show: true,
            color: '#fff',
            fontSize: 12,
            fontWeight: 'bold',
          },
        },
        itemStyle: {
          emphasis: {
            areaColor: '#C8A96E',
            borderColor: '#fff',
            borderWidth: 2,
          },
        },
      },
    ],
  };

  return (
    <div className={className} style={{ height: '450px' }}>
      <ReactECharts
        option={option}
        style={{ height: '450px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        onChartReady={() => {
          // 注册地图
          if (mapData) {
            echarts.registerMap('china', mapData);
          }
        }}
      />
    </div>
  );
}
