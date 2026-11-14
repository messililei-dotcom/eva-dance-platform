"use client";
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, CalendarDays, Trophy, ShoppingBag, UserRound } from 'lucide-react';
import { activeMobileTab, type MobileTab } from '@/lib/mobile-app-navigation';
const items: {key:MobileTab;href:string;label:string;icon:typeof BookOpen}[] = [
  {key:'academy',href:'/courses',label:'线上学院',icon:BookOpen},
  {key:'offline',href:'/offline',label:'线下课',icon:CalendarDays},
  {key:'events',href:'/events',label:'赛事',icon:Trophy},
  {key:'shop',href:'/shop',label:'商城',icon:ShoppingBag},
  {key:'profile',href:'/dashboard/profile',label:'个人中心',icon:UserRound},
];
export default function BottomNav(){
  const pathname=usePathname() || '/';
  if (/^\/courses\/[^/]+\/videos(?:\/|$)/.test(pathname)) return null;
  const active=activeMobileTab(pathname);
  return <nav className="mobile-app-tabbar" aria-label="主要功能导航">
    {items.map(item=><Link key={item.key} href={item.href} aria-current={active===item.key?'page':undefined} className={active===item.key?'is-active':''}>
      <item.icon aria-hidden="true" size={23} strokeWidth={1.8}/><span>{item.label}</span>
    </Link>)}
  </nav>;
}
