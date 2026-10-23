'use client';

import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import ScrollAnimation from '@/components/ScrollAnimation';

// 中国地图 GeoJSON CDN 地址
const CHINA_MAP_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';

// 模拟学员分布数据（后续对接学员管理系统API）
const mockStudentData = [
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

// 国外学员数据
const foreignStudentData = [
  { name: '韩国', value: 3 },
  { name: '台湾', value: 2 },
  { name: '意大利', value: 1 },
  { name: '越南', value: 1 },
  { name: '日本', value: 1 },
];

interface StudentMapSectionProps {
  className?: string;
}

export default function StudentMapSection({ className }: StudentMapSectionProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<echarts.ECharts | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 动态加载中国地图数据
    const loadMap = async () => {
      try {
        // 从阿里云 DataV CDN 获取中国地图 GeoJSON
        const response = await fetch(CHINA_MAP_URL);
        const chinaJson = await response.json();
        
        // 注册中国地图
        echarts.registerMap('china', chinaJson);
        const chinaGeoCoordMap: Record<string, [number, number]> = {
          '湖南': [112.982279, 28.194762],
          '北京': [116.405285, 39.904989],
          '上海': [121.474629, 31.230416],
          '广东': [113.280637, 23.125178],
          '浙江': [120.153576, 30.287459],
          '四川': [104.065735, 30.659462],
          '江苏': [118.767413, 32.041544],
          '湖北': [114.298572, 30.584355],
          '山东': [117.000923, 36.675807],
          '河南': [113.665412, 34.757975],
          '重庆': [106.504962, 29.533155],
          '福建': [119.306239, 26.075302],
          '陕西': [108.948024, 34.263161],
          '辽宁': [123.429096, 41.796767],
        };

        if (chartRef.current) {
          const myChart = echarts.init(chartRef.current, undefined, {
            renderer: 'canvas',
          });

          // 散点数据
          const scatterData = mockStudentData.map(item => ({
            name: item.name,
            value: [...(chinaGeoCoordMap[item.name] || [0, 0]), item.value],
          }));

          const option: echarts.EChartsOption = {
            title: {
              text: '学员分布地图',
              left: 'center',
              top: 20,
              textStyle: {
                color: '#fff',
                fontSize: 18,
                fontWeight: 'bold',
              },
            },
            tooltip: {
              trigger: 'item',
              formatter: (params: any) => {
                if (params.seriesType === 'scatter') {
                  return `${params.name}<br/>学员数：${params.value[2]}人`;
                }
                return params.name;
              },
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderColor: '#333',
              textStyle: {
                color: '#fff',
              },
            },
            visualMap: {
              min: 0,
              max: 40,
              left: 'left',
              top: 'bottom',
              text: ['高', '低'],
              calculable: true,
              inRange: {
                color: ['#50a3ba', '#eac736', '#d94e5d'],
              },
              textStyle: {
                color: '#fff',
              },
            },
            geo: {
              map: 'china',
              roam: true,
              label: {
                show: true,
                color: '#fff',
              },
              itemStyle: {
                areaColor: '#323c48',
                borderColor: '#404a59',
                borderWidth: 1,
              },
              emphasis: {
                label: { show: true, color: '#fff' },
                itemStyle: { areaColor: '#2a333d' },
              },
              zoom: 1.2,
            },
            series: [
              {
                name: '学员分布',
                type: 'scatter',
                coordinateSystem: 'geo',
                data: scatterData,
                symbolSize: (val: number[]) => Math.max(val[2] * 1.5, 8),
                label: {
                  formatter: '{b}',
                  position: 'right',
                  show: true,
                  color: '#fff',
                  fontSize: 10,
                },
                itemStyle: {
                  color: '#ddb926',
                  shadowBlur: 10,
                  shadowColor: 'rgba(255, 178, 72, 0.5)',
                },
                emphasis: {
                  scale: true,
                },
              },
              {
                name: '热力效果',
                type: 'effectScatter',
                coordinateSystem: 'geo',
                data: scatterData.filter(d => d.value[2] > 5).slice(0, 5),
                symbolSize: (val: number[]) => Math.max(val[2] * 0.8, 6),
                showEffectOn: 'render',
                rippleEffect: {
                  brushType: 'stroke',
                  scale: 3,
                },
                label: {
                  formatter: '{b}',
                  position: 'right',
                  show: true,
                },
                itemStyle: {
                  color: '#f4e925',
                  shadowBlur: 10,
                  shadowColor: '#333',
                },
                zlevel: 1,
              },
            ],
          };

          // 注册中国地图（已在前面注册）
          // echarts.registerMap('china', chinaJson);
          myChart.setOption(option);
          setChart(myChart);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('地图加载失败:', error);
        setIsLoading(false);
      }
    };

    loadMap();

    // 响应式调整
    const handleResize = () => {
      chart?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      chart?.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [chart]);

  // 计算统计数据
  const totalStudents = mockStudentData.reduce((sum, item) => sum + item.value, 0) + 
                        foreignStudentData.reduce((sum, item) => sum + item.value, 0);
  const provinces = mockStudentData.length;
  const countries = foreignStudentData.length + 1;

  return (
    <section className={`py-10 md:py-14 bg-gradient-to-br from-crimson-dark via-crimson to-crimson-dark ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollAnimation>
          <div className="text-center mb-8">
            <span className="inline-block px-3 py-1 bg-white/10 text-gold-light text-sm font-medium rounded-full mb-3">
              学员分布
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-2">
              全国学员分布地图
            </h2>
            <p className="text-white/70 max-w-xl mx-auto">
              伊娃东方舞学员遍布全国 {provinces} 个省份，{countries} 个国家/地区
            </p>
          </div>
        </ScrollAnimation>

        {/* Stats Summary */}
        <ScrollAnimation delay={100}>
          <div className="grid grid-cols-3 gap-4 mb-8 text-center">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-3xl font-bold text-gold">{totalStudents}</div>
              <div className="text-white/60 text-sm">学员总数</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-3xl font-bold text-gold">{provinces}</div>
              <div className="text-white/60 text-sm">覆盖省份</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-3xl font-bold text-gold">{countries}</div>
              <div className="text-white/60 text-sm">国家/地区</div>
            </div>
          </div>
        </ScrollAnimation>

        {/* Map Container */}
        <ScrollAnimation delay={200}>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            {isLoading && (
              <div className="flex items-center justify-center h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
                <span className="ml-3 text-white/60">加载地图...</span>
              </div>
            )}
            <div
              ref={chartRef}
              className="w-full h-[400px] md:h-[500px]"
              style={{ display: isLoading ? 'none' : 'block' }}
            />
          </div>
        </ScrollAnimation>

        {/* Foreign Countries */}
        <ScrollAnimation delay={300}>
          <div className="mt-6 text-center">
            <p className="text-white/50 text-sm">
              海外学员：{foreignStudentData.map(d => `${d.name}(${d.value}人)`).join('、')}
            </p>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
