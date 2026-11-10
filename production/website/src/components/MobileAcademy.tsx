"use client";
import { CourseAccessLabel, courseSeriesId } from './CourseAccess';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CalendarDays, Trophy, Search, RefreshCw } from 'lucide-react';
import { type Course } from '@/config/courses';
import { getCourseVideoHref } from '@/lib/course-series-ids';
import PlaceholderImage from './PlaceholderImage';
type CatalogCourse = Course & { platformSeriesId?: number; platformCourseId?: number; legacyCourseId?: string };
type Props={limit?:number;courses?:CatalogCourse[];loading?:boolean;error?:string;onRetry?:()=>void};
export default function MobileAcademy(props:Props){
  const [rows,setRows]=useState<CatalogCourse[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[query,setQuery]=useState('');
  const supplied=props.courses!==undefined;
  useEffect(()=>{
    if(supplied)return;
    const controller=new AbortController();
    fetch('/api/platform-courses',{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(!response.ok)throw Error('课程加载失败，请重试');
      const payload=await response.json();if(payload?.success===false)throw Error(payload.message||'课程加载失败，请重试');
      const data=Array.isArray(payload)?payload:payload.data;if(!Array.isArray(data))throw Error('课程暂时无法加载，请重试');
      setRows(data);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message||'课程加载失败，请重试');}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[supplied,attempt]);
  const loading=supplied?props.loading:busy,problem=supplied?props.error:error;
  const courses=props.courses??rows;
  const visible=useMemo(()=>{const q=query.trim().toLocaleLowerCase();return courses.filter(c=>(c.category==='online'||c.category==='dance-collection')&&(!q||[c.title,c.instructor,c.description,c.type].join(' ').toLocaleLowerCase().includes(q)));},[courses,query]);
  return <section className="mobile-academy" data-mobile-surface="academy">
    <h1>伊娃东方舞</h1><p className="mobile-intro">线上学院 · 从基础到进阶，找到适合你的课程</p>
    <div className="mobile-learning-links">
      <Link href="/my-courses"><BookOpen aria-hidden="true"/><span>我的课程</span></Link>
      <Link href="/offline?tab=rights"><CalendarDays aria-hidden="true"/><span>课时与核销</span></Link>
      <Link href="/dashboard/events"><Trophy aria-hidden="true"/><span>我的比赛</span></Link>
    </div>
    <div className="mobile-catalog-heading"><h2>课程列表</h2>{!loading&&!problem&&<span>{visible.length} 门课程</span>}</div>
    <label className="mobile-catalog-search"><Search size={20} aria-hidden="true"/><span className="sr-only">搜索课程、老师或分类</span><input type="search" placeholder="搜索课程、老师或分类" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    {loading?<p role="status" className="mobile-feedback">课程加载中…</p>:problem?<div className="mobile-feedback" role="alert"><p>{problem}</p><button onClick={()=>{if(supplied)props.onRetry?.();else{setBusy(true);setError('');setAttempt(v=>v+1);}}}><RefreshCw size={18} aria-hidden="true"/>重新加载</button></div>:visible.length?<div className="mobile-course-list">{(props.limit&&!query.trim()?visible.slice(0,props.limit):visible).map(course=>{
      const platform=course.platformSeriesId||course.platformCourseId;
      const href=getCourseVideoHref({courseId:platform?course.id:(course.legacyCourseId||course.id),legacyCourseId:course.legacyCourseId,platformSeriesId:platform});
      return <Link href={href} key={String(platform||course.id)} className="mobile-course-row"><div className="mobile-course-cover"><PlaceholderImage src={course.image||'/images/placeholder.svg'} alt="" className="object-cover"/></div><div className="mobile-course-copy"><span className="mobile-course-category">{course.category==='dance-collection'?'成品舞':'线上系统课'}</span><h3>{course.title}</h3>{course.instructor&&<p>{course.instructor}</p>}<div className="mobile-course-meta"><span>{course.duration}</span>{course.displayStudents!==undefined&&<span>{course.displayStudents} 名学员</span>}</div><CourseAccessLabel showAction pricingConfirmed={Boolean(course.platformSeriesId || course.platformCourseId)} seriesId={courseSeriesId(course)} price={course.price} originalPrice={course.originalPrice}/></div></Link>;
    })}</div>:<p className="mobile-feedback">{query.trim()?'没有找到相关课程，请换个关键词':'课程即将更新，稍后再来看看'}</p>}
    {props.limit&&visible.length>props.limit&&!query.trim()&&<Link href="/courses" className="mobile-all-courses">查看全部课程</Link>}
    <div className="mobile-brand-links"><Link href="/about">了解伊娃东方舞</Link><Link href="/dance-circle">东方舞圈资讯</Link><Link href="/contact">联系与合作</Link></div>
  </section>;
}
