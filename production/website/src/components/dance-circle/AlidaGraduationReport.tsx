import Image from 'next/image';

const imageRoot = '/images/reports/alida-2026-graduation';

const gallery = [
  { src: `${imageRoot}/moment-03.png`, width: 432, height: 612, alt: 'ALIDA 林亦洛大师班课堂与结业瞬间' },
  { src: `${imageRoot}/moment-04.png`, width: 430, height: 616, alt: 'ALIDA 林亦洛大师班学员训练瞬间' },
  { src: `${imageRoot}/moment-05.png`, width: 438, height: 622, alt: 'ALIDA 林亦洛大师班课堂交流瞬间' },
  { src: `${imageRoot}/moment-06.png`, width: 434, height: 550, alt: 'ALIDA 林亦洛大师班结业合影瞬间' },
  { src: `${imageRoot}/moment-07.jpg`, width: 1080, height: 1440, alt: 'ALIDA 林亦洛大师班精彩瞬间' },
];

export default function AlidaGraduationReport() {
  return (
    <div className="mt-12 space-y-14 md:mt-16 md:space-y-20">
      <section className="overflow-hidden rounded-[2rem] bg-[#2C1810] px-6 py-9 text-[#FBF7EF] shadow-xl md:px-10 md:py-12">
        <div className="grid gap-9 md:grid-cols-[0.9fr_1.1fr] md:gap-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#DAB96E]">Graduation Review</p>
            <h2 className="mt-4 font-serif text-3xl font-bold leading-tight md:text-4xl">七天沉浸学习，留下珍贵而难忘的大师班时光</h2>
            <blockquote className="mt-7 border-l-2 border-[#DAB96E] pl-5 font-serif text-lg leading-8 text-[#EBDDC8]">
              这不只是一场课程结业，更是一段关于身体、音乐、艺术表达与舞蹈信念的共同成长。
            </blockquote>
          </div>
          <div className="space-y-5 text-sm leading-7 text-[#E3D8CD] md:text-base md:leading-8">
            <p>七天的沉浸学习，将成为舞蹈道路上珍贵而难忘的回忆。来自全国各地的舞者们，因为对东方舞共同的热爱而相聚长沙。七天里，我们一起探索身体的无限可能，感受艺术的魅力，聆听大师的智慧，在汗水与成长中不断突破自我。</p>
            <p>衷心感谢台湾东方舞艺术家 ALIDA 林亦洛老师倾囊相授，将多年积累的舞蹈理念、身体训练方法、编舞思维与艺术表达毫无保留地分享给大家。每一次示范、每一次指导、每一句鼓励，都将成为我们继续前行的力量。</p>
            <p>愿每一位学员都能带着收获与感动满载而归，把这份热爱延续到未来的每一次练习、每一次表演和每一次成长之中。</p>
          </div>
        </div>
      </section>

      <section>
        <div className="grid gap-5 md:grid-cols-2 md:gap-7">
          <figure className="overflow-hidden rounded-3xl bg-white shadow-lg">
            <Image src={`${imageRoot}/classroom-01.png`} width={438} height={584} alt="ALIDA 林亦洛老师大师班课堂示范" sizes="(min-width: 768px) 420px, 100vw" className="h-auto w-full" />
            <figcaption className="px-5 py-4 text-sm leading-6 text-[#746454]">课堂里的每一次示范，都是身体语言的重新打开。</figcaption>
          </figure>
          <figure className="overflow-hidden rounded-3xl bg-white shadow-lg md:mt-16">
            <Image src={`${imageRoot}/classroom-02.png`} width={432} height={614} alt="ALIDA 林亦洛大师班学员课堂训练" sizes="(min-width: 768px) 420px, 100vw" className="h-auto w-full" />
            <figcaption className="px-5 py-4 text-sm leading-6 text-[#746454]">在细节训练中沉淀力量，在艺术表达中看见成长。</figcaption>
          </figure>
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center font-serif text-xl leading-9 text-[#8B6A32] md:text-2xl">让我们把这份感动与成长记录下来，共同珍藏这段美好的大师班时光。</p>
      </section>

      <section>
        <div className="mb-8 grid gap-4 md:grid-cols-[1fr_0.8fr] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#A87C32]">Classroom Moments</p>
            <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[#2C1810] md:text-4xl">把热爱与成长，定格成一帧帧发光的画面</h2>
          </div>
          <p className="text-sm leading-7 text-[#746454]">课堂、训练、交流与结业时刻，按原始报道顺序完整保留这段七天大师班记忆。</p>
        </div>
        <div className="columns-2 gap-4 md:columns-3 md:gap-5">
          {gallery.map((image, index) => (
            <figure key={image.src} className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl bg-[#E8DDCB] shadow-md md:mb-5">
              <Image src={image.src} width={image.width} height={image.height} alt={image.alt} sizes="(min-width: 768px) 280px, 48vw" className="h-auto w-full transition duration-500 group-hover:scale-[1.02]" />
              <figcaption className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold tracking-widest text-white">{String(index + 4).padStart(2, '0')}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#77151B] via-[#3C1516] to-[#1E1210] text-white shadow-2xl">
        <div className="grid md:grid-cols-[1fr_0.72fr]">
          <div className="flex flex-col justify-center px-6 py-10 md:px-10 md:py-14">
            <span className="w-fit rounded-full border border-[#E0BD73]/50 bg-white/10 px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-[#F0D49B]">NEXT MASTERCLASS</span>
            <h2 className="mt-5 font-serif text-3xl font-bold leading-tight md:text-4xl">第二期 · 7日制埃风系统大师班</h2>
            <div className="mt-7 space-y-4 text-sm leading-7 text-[#F0E5D8] md:text-base">
              <p>世界顶尖东方舞艺术家<br /><strong className="text-lg text-white">ALIDA 林亦洛老师</strong></p>
              <p>地点：中国 · 长沙<br />时间：2027年4月22日—28日</p>
            </div>
            <p className="mt-7 border-t border-white/15 pt-5 text-xs leading-6 text-[#D9C1AE]">课程咨询（微信）：yiwa2025、yiwa2028、yiwa2029</p>
          </div>
          <div className="relative min-h-[520px] bg-black/20 md:min-h-[620px]">
            <Image src={`${imageRoot}/next-masterclass.jpg`} alt="2027年 ALIDA 林亦洛老师第二期七日制埃风系统大师班预告" fill sizes="(min-width: 768px) 360px, 100vw" className="object-cover object-top" />
          </div>
        </div>
      </section>

      <section className="py-2 text-center md:py-4">
        <div className="mx-auto mb-5 h-px w-16 bg-[#C8A96E]" />
        <p className="font-serif text-2xl leading-10 text-[#2C1810] md:text-3xl">期待与大家再次相聚，<br />明年春天，我们长沙见！</p>
      </section>
    </div>
  );
}
