'use client';

import { useEffect, useRef, useState } from 'react';
import type { ECharts, EChartsOption } from 'echarts';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { disciples } from '@/data/disciples';

const baseStudentData = [
  { name: '湖南省', value: 1050 },
  { name: '北京市', value: 680 },
  { name: '上海市', value: 620 },
  { name: '广东省', value: 580 },
  { name: '浙江省', value: 520 },
  { name: '四川省', value: 460 },
  { name: '江苏省', value: 420 },
  { name: '湖北省', value: 380 },
  { name: '山东省', value: 350 },
  { name: '河南省', value: 320 },
  { name: '重庆市', value: 300 },
  { name: '福建省', value: 250 },
  { name: '陕西省', value: 230 },
  { name: '辽宁省', value: 210 },
  { name: '安徽省', value: 190 },
  { name: '江西省', value: 180 },
  { name: '河北省', value: 170 },
  { name: '山西省', value: 160 },
  { name: '吉林省', value: 130 },
  { name: '黑龙江省', value: 120 },
  { name: '云南省', value: 115 },
  { name: '贵州省', value: 110 },
  { name: '甘肃省', value: 100 },
  { name: '海南省', value: 90 },
  { name: '青海省', value: 60 },
  { name: '内蒙古自治区', value: 80 },
  { name: '广西壮族自治区', value: 100 },
  { name: '西藏自治区', value: 35 },
  { name: '宁夏回族自治区', value: 55 },
  { name: '新疆维吾尔自治区', value: 85 },
  { name: '天津市', value: 180 },
  { name: '香港特别行政区', value: 50 },
  { name: '澳门特别行政区', value: 15 },
  { name: '台湾省', value: 80 },
];

const provinceAliases: Record<string, string> = {
  北京: '北京市',
  天津: '天津市',
  上海: '上海市',
  重庆: '重庆市',
  河北: '河北省',
  山西: '山西省',
  辽宁: '辽宁省',
  吉林: '吉林省',
  黑龙江: '黑龙江省',
  江苏: '江苏省',
  浙江: '浙江省',
  安徽: '安徽省',
  福建: '福建省',
  江西: '江西省',
  山东: '山东省',
  河南: '河南省',
  湖北: '湖北省',
  湖南: '湖南省',
  广东: '广东省',
  海南: '海南省',
  四川: '四川省',
  贵州: '贵州省',
  云南: '云南省',
  陕西: '陕西省',
  甘肃: '甘肃省',
  青海: '青海省',
  台湾: '台湾省',
  内蒙古: '内蒙古自治区',
  广西: '广西壮族自治区',
  西藏: '西藏自治区',
  宁夏: '宁夏回族自治区',
  新疆: '新疆维吾尔自治区',
  香港: '香港特别行政区',
  澳门: '澳门特别行政区',
};

const discipleCityCoords: Record<string, [number, number]> = {
  株洲: [113.13, 27.83],
  邵阳: [111.47, 27.24],
  长沙: [112.94, 28.23],
  衡阳: [112.57, 26.89],
  石嘴山: [106.38, 38.98],
  南昌: [115.86, 28.68],
  武汉: [114.31, 30.52],
  永州: [111.61, 26.42],
  益阳: [112.36, 28.55],
  贺州: [111.57, 24.4],
  常德: [111.69, 29.04],
  湘潭: [112.94, 27.83],
  岳阳: [113.13, 29.36],
  九江: [116.0, 29.7],
  三亚: [109.51, 18.25],
  滁州: [118.32, 32.3],
  玉林: [110.18, 22.65],
  茂名: [110.92, 21.67],
  昌吉回族自治州: [87.31, 44.01],
  唐山: [118.18, 39.63],
  宜春: [114.42, 27.82],
};

interface ChinaMapProps {
  className?: string;
}

function normalizeProvinceName(name: string) {
  const trimmed = name.trim();
  return provinceAliases[trimmed] || trimmed;
}

function mergeStudentData(extraData: { province: string; count: number }[]) {
  const totals = new Map(baseStudentData.map(item => [item.name, item.value]));

  extraData.forEach(item => {
    const province = normalizeProvinceName(item.province);
    totals.set(province, (totals.get(province) || 0) + item.count);
  });

  return Array.from(totals, ([name, value]) => ({ name, value }));
}

function getDiscipleCityData() {
  const grouped = new Map<string, { province: string; city: string; value: number; names: string[] }>();

  disciples.forEach(disciple => {
    const key = `${disciple.province}-${disciple.city}`;
    const current = grouped.get(key) || {
      province: disciple.province,
      city: disciple.city,
      value: 0,
      names: [],
    };
    current.value += 1;
    current.names.push(disciple.name);
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .map(item => {
      const coord = discipleCityCoords[item.city];
      if (!coord) return null;

      return {
        name: item.city,
        value: [...coord, item.value],
        province: item.province,
        names: item.names.slice(0, 6).join('、'),
      };
    })
    .filter(Boolean);
}

export default function ChinaMap({ className }: ChinaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const zoomMap = (zoom: number) => {
    chartRef.current?.dispatchAction({
      type: 'geoRoam',
      zoom,
    } as any);
  };

  const resetMap = () => {
    chartRef.current?.setOption({
      geo: {
        zoom: 1.55,
        center: [104.2, 34.8],
      },
    });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    const initChart = async () => {
      try {
        const [echarts, mapResponse] = await Promise.all([
          import('echarts'),
          fetch('/china.json'),
        ]);

        if (!mapResponse.ok) {
          throw new Error(`地图数据加载失败: HTTP ${mapResponse.status}`);
        }

        const chinaJson = await mapResponse.json();
        const studentData = mergeStudentData([]);
        const disciplePoints = getDiscipleCityData();
        const maxValue = Math.max(...studentData.map(item => item.value), 1);

        if (cancelled || !containerRef.current) return;

        echarts.registerMap('china', chinaJson);

        const chart = echarts.init(containerRef.current!, undefined, {
          renderer: 'canvas',
        });
        chartRef.current = chart;

        const option: EChartsOption = {
          backgroundColor: 'transparent',
          tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(20, 24, 43, 0.96)',
            borderColor: '#F3D28A',
            borderWidth: 1,
            textStyle: { color: '#fff', fontSize: 14 },
            formatter: (params: any) => {
              if (params.seriesName === '传承弟子') {
                const value = Array.isArray(params.value) ? params.value[2] : 0;
                return `<div style="padding:10px 12px;">
                  <div style="font-size:15px;font-weight:bold;color:#F3D28A;margin-bottom:6px;">${params.data.province} · ${params.name}</div>
                  <div style="color:#fff;margin-bottom:4px;">传承弟子：<span style="font-weight:bold;color:#F3D28A;">${value}位</span></div>
                  <div style="max-width:220px;color:rgba(255,255,255,.72);line-height:1.6;">${params.data.names}</div>
                </div>`;
              }

              const value = params.data?.value || 0;
              return `<div style="padding:12px;">
                <div style="font-size:16px;font-weight:bold;color:#F3D28A;margin-bottom:8px;">${params.name}</div>
                <div style="color:#fff;">学员人数：<span style="font-size:18px;font-weight:bold;color:#F3D28A;">${value}人</span></div>
              </div>`;
            },
          },
          visualMap: {
            min: 0,
            max: maxValue,
            text: ['多', '少'],
            textStyle: { color: '#F8E9C8', fontSize: 12, fontWeight: 600 },
            inRange: {
              color: ['#2269C9', '#11A8B8', '#4DBD74', '#F1C453', '#E97842', '#C9234B'],
            },
            orient: 'horizontal',
            left: 'center',
            bottom: 12,
            itemWidth: 15,
            itemHeight: 170,
            calculable: true,
            backgroundColor: 'rgba(12,18,36,0.36)',
            borderColor: 'rgba(255,255,255,0.18)',
            borderWidth: 1,
            padding: [6, 10],
          },
          geo: {
            map: 'china',
            roam: true,
            zoom: 1.55,
            center: [104.2, 34.8],
            scaleLimit: {
              min: 1,
              max: 5,
            },
            selectedMode: false,
            layoutCenter: ['50%', '51%'],
            layoutSize: '122%',
            itemStyle: {
              borderColor: 'rgba(255,255,255,0.72)',
              borderWidth: 1,
              areaColor: '#2269C9',
              shadowBlur: 10,
              shadowColor: 'rgba(0,0,0,0.24)',
            },
            emphasis: {
              disabled: false,
              itemStyle: {
                areaColor: '#FFD166',
                borderColor: '#fff',
                borderWidth: 1.5,
              },
              label: {
                color: '#151827',
                fontWeight: 700,
              },
            },
            label: {
              show: true,
              color: 'rgba(255,255,255,0.92)',
              fontSize: 9,
              textShadowColor: 'rgba(0,0,0,0.38)',
              textShadowBlur: 3,
            },
          },
          series: [
            {
              name: '国内学员',
              type: 'map',
              map: 'china',
              geoIndex: 0,
              roam: true,
              selectedMode: false,
              scaleLimit: {
                min: 1,
                max: 5,
              },
              data: studentData,
            },
            {
              name: '传承弟子',
              type: 'effectScatter',
              coordinateSystem: 'geo',
              data: disciplePoints,
              zlevel: 2,
              symbolSize: (value: number[]) => Math.min(24, 10 + value[2] * 2),
              rippleEffect: {
                brushType: 'stroke',
                scale: 3.2,
                period: 4,
              },
              label: {
                show: true,
                formatter: '{b}',
                position: 'right',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: 'rgba(139,26,26,0.88)',
                borderColor: 'rgba(243,210,138,0.8)',
                borderWidth: 1,
                borderRadius: 4,
                padding: [3, 6],
                distance: 7,
              },
              itemStyle: {
                color: '#D7263D',
                borderColor: '#fff',
                borderWidth: 2,
                shadowBlur: 16,
                shadowColor: 'rgba(215,38,61,0.75)',
              },
              emphasis: {
                scale: 1.18,
                label: {
                  backgroundColor: 'rgba(243,210,138,0.96)',
                  color: '#2B1020',
                },
              },
            },
          ],
        };

        chart.setOption(option, true);
        setLoading(false);

        const handleResize = () => chart.resize();
        window.addEventListener('resize', handleResize);
        cleanupRef.current = () => {
          window.removeEventListener('resize', handleResize);
          chart.dispose();
          chartRef.current = null;
        };

        fetch('/api/student-distribution')
          .then(response => (response.ok ? response.json() : null))
          .then(payload => {
            if (cancelled || !chartRef.current) return;

            const managementData = Array.isArray(payload?.data) ? payload.data : [];
            if (managementData.length === 0) return;

            const updatedStudentData = mergeStudentData(managementData);
            const updatedMaxValue = Math.max(...updatedStudentData.map(item => item.value), 1);
            chartRef.current.setOption({
              visualMap: { max: updatedMaxValue },
              series: [
                {
                  name: '国内学员',
                  data: updatedStudentData,
                },
              ],
            });
          })
          .catch(() => undefined);
      } catch (err) {
        if (cancelled) return;

        console.error('地图初始化失败:', err);
        setError(err instanceof Error ? err.message : '地图加载失败');
        setLoading(false);
      }
    };

    initChart();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  if (error) {
    return (
      <div className={`w-full h-[500px] bg-[#1a1a2e]/50 rounded-lg flex flex-col items-center justify-center ${className || ''}`}>
        <p className="mb-3 text-sm text-red-400">地图加载失败</p>
        <p className="mb-4 px-4 text-center text-xs text-white/50">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); }}
          className="px-4 py-2 bg-gold/20 text-gold border border-gold/30 rounded-lg text-sm hover:bg-gold/30 transition-colors"
        >
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className={`relative h-[360px] w-full touch-pan-x touch-pan-y overflow-hidden rounded-lg bg-gradient-to-br from-[#17345F] via-[#162A4F] to-[#25133A] md:h-[500px] ${className || ''}`}>
      <div
        ref={containerRef}
        className="absolute inset-0"
      />
      <div className="absolute right-2 top-2 z-10 flex overflow-hidden rounded-lg border border-white/15 bg-[#101A33]/80 shadow-lg shadow-black/20 backdrop-blur md:right-3 md:top-3">
        <button
          type="button"
          onClick={() => zoomMap(1.25)}
          className="flex h-8 w-8 items-center justify-center text-white/85 transition hover:bg-white/15 hover:text-[#F3D28A] md:h-9 md:w-9"
          aria-label="放大地图"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomMap(0.8)}
          className="flex h-8 w-8 items-center justify-center border-l border-white/10 text-white/85 transition hover:bg-white/15 hover:text-[#F3D28A] md:h-9 md:w-9"
          aria-label="缩小地图"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={resetMap}
          className="flex h-8 w-8 items-center justify-center border-l border-white/10 text-white/85 transition hover:bg-white/15 hover:text-[#F3D28A] md:h-9 md:w-9"
          aria-label="重置地图"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]/70">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-gold"></div>
            <p className="text-white/70">正在生成地图...</p>
          </div>
        </div>
      )}
    </div>
  );
}
