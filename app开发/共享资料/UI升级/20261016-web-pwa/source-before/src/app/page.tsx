import StatsMapSection from '@/components/sections/StatsMapSection';
import BrandStorySection from '@/components/sections/BrandStorySection';
import QuickCardsSection from '@/components/sections/QuickCardsSection';
import PublicationSection from '@/components/sections/PublicationSection';
import EndorsementSection from '@/components/sections/EndorsementSection';
import VideoCoursesSection from '@/components/sections/VideoCoursesSection';
import DanceCollectionSection from '@/components/sections/DanceCollectionSection';
import DisciplesShowcaseSection from '@/components/sections/DisciplesShowcaseSection';
import OfflineFeaturedSection from '@/components/sections/OfflineFeaturedSection';
import LatestNewsSection from '@/components/sections/LatestNewsSection';
import CTASection from '@/components/sections/CTASection';
import { getPlatformHomeStats } from '@/lib/platform-home-stats';
import { disciples } from '@/data/disciples';

export const runtime = 'nodejs';
export const revalidate = 300;

export default async function HomePage() {
  const initialStats = await getPlatformHomeStats();

  return (
    <div className="home-complete-shell">
        {/* 1. Stats & Map - 用数字说话（核心数据 + 学员分布地图） */}
        <StatsMapSection initialStats={initialStats} discipleCount={disciples.length} />

        {/* 2. Brand Story */}
        <BrandStorySection />

        {/* 3. Quick Cards - brand culture pathways */}
        <QuickCardsSection />

        {/* 4. Publication - culture method anchor */}
        <PublicationSection />

        {/* 5. Endorsement - system keywords */}
        <EndorsementSection />

        {/* 6. 线上学院视频课程精选 - 4:3主图 */}
        <VideoCoursesSection />

        {/* 7. 成品舞作品精选 */}
        <DanceCollectionSection />

        {/* 8. 线下培训课程精选 */}
        <OfflineFeaturedSection />

        {/* 9. 传承弟子随机展示 */}
        <DisciplesShowcaseSection />

        {/* 10. Latest News */}
        <LatestNewsSection />

        {/* 11. CTA */}
        <CTASection />
    </div>
  );
}
