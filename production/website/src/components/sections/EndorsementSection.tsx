'use client';

import { BookOpen, Award, Users, GraduationCap } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import SectionHeader from '@/components/SectionHeader';

const endorsements = [
  { icon: BookOpen, label: '《东方舞技巧大全》', desc: '核心技巧与教学法入门' },
  { icon: Award, label: 'SWOD教学系统', desc: '呼吸、核心、技巧到编舞' },
  { icon: Users, label: '成品舞作品库', desc: '经典、民俗、国风与融舞' },
  { icon: GraduationCap, label: '师资认证路径', desc: '从舞者成长为教师' },
  { icon: BookOpen, label: '线上线下闭环', desc: '录播复盘与线下纠正' },
  { icon: Award, label: '传承弟子培养', desc: '长期陪伴式学习体系' },
];

export default function EndorsementSection() {
  return (
    <section id="endorsement" className="overflow-hidden border-y border-sand/30 bg-gold/5 py-4 md:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden">
          <div className="marquee-track">
            {/* First set */}
            {endorsements.map((item, i) => (
              <div
                key={`first-${i}`}
                className="flex items-center gap-3 px-8 py-4 mx-2 whitespace-nowrap"
              >
                <item.icon className="w-5 h-5 text-gold flex-shrink-0" />
                <div>
                  <span className="font-medium text-text text-sm">{item.label}</span>
                  <span className="text-xs text-text-muted ml-2">{item.desc}</span>
                </div>
              </div>
            ))}
            {/* Duplicate for seamless loop */}
            {endorsements.map((item, i) => (
              <div
                key={`second-${i}`}
                className="flex items-center gap-3 px-8 py-4 mx-2 whitespace-nowrap"
              >
                <item.icon className="w-5 h-5 text-gold flex-shrink-0" />
                <div>
                  <span className="font-medium text-text text-sm">{item.label}</span>
                  <span className="text-xs text-text-muted ml-2">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
