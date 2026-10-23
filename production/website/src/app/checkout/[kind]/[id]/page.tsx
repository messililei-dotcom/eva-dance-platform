import {notFound} from 'next/navigation';
import CourseCheckout from '@/components/CourseCheckout';
export const metadata={title:'确认课程订单',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{kind:string;id:string}>}){const {kind,id}=await params;if(!['online','offline','event'].includes(kind)||!/^\d+$/.test(id))notFound();return <CourseCheckout kind={kind as 'online'|'offline'|'event'} id={id}/>;}
