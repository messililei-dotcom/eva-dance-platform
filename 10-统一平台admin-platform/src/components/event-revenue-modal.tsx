'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Modal, Table, Tag } from 'antd';
import { api } from '@/lib/api';

export default function EventRevenueModal({competitionId,totalFen,open,onClose}:{competitionId:number;totalFen:number;open:boolean;onClose:()=>void}) {
  const [rows,setRows]=useState<any[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{if(open)setPage(1);},[open,competitionId]);
  useEffect(()=>{
    if(!open)return;
    let active=true;setBusy(true);setError('');
    api.get('/event/competitions/'+competitionId+'/revenue',{params:{page,pageSize:20}})
      .then(r=>{if(active){setRows(r.data.data);setTotal(r.data.total);}})
      .catch(e=>{if(active)setError(e?.response?.data?.error||'收入明细加载失败，请重试');})
      .finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[open,competitionId,page,retry]);
  const methods:Record<string,string>={wechat:'微信',alipay:'支付宝',bank:'银行卡',cash:'现金',other:'其他'};
  return <Modal title="总收入明细" open={open} onCancel={onClose} footer={<Button onClick={onClose}>关闭</Button>} width={1000}>
    <p>实际总收入 <strong>¥{(Number(totalFen||0)/100).toFixed(2)}</strong>，已扣除退款。删除报名会保留收退款流水，不会自动退款。</p>
    {error&&<Alert type="error" showIcon message={<span role="alert">{error}</span>} action={<Button onClick={()=>setRetry(n=>n+1)}>重试</Button>}/>}
    <Table size="small" rowKey="recordKey" dataSource={error?[]:rows} loading={busy} scroll={{x:900}} pagination={{current:page,pageSize:20,total,onChange:setPage,showSizeChanger:false}} columns={[
      {title:'选手',dataIndex:'name',width:150,render:(name:string,row:any)=><>{name}{!!row.isDeleted&&<Tag color="red" style={{marginLeft:6}}>已删除报名</Tag>}</>},
      {title:'组别',dataIndex:'groupName',width:200},
      {title:'登记',dataIndex:'kind',width:100,render:(kind:string)=>(({charge:'缴费',refund:'退款',balance:'历史余额'} as Record<string,string>)[kind]||kind)},
      {title:'金额',dataIndex:'amountFen',width:110,render:(value:number,row:any)=><span style={{color:row.kind==='refund'?'#a8071a':undefined}}>{row.kind==='refund'?'-':''}¥{(Number(value)/100).toFixed(2)}</span>},
      {title:'方式',dataIndex:'method',width:90,render:(method:string)=>methods[method]||method||'-'},
      {title:'收退款时间',dataIndex:'paidAt',width:180,render:(value:string)=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'-'},
      {title:'备注',dataIndex:'remark',width:220},
    ]}/>
  </Modal>;
}
