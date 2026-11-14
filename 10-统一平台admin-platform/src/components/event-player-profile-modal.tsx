'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Col, Form, Input, Modal, Row, Select, Spin } from 'antd';
import { api } from '@/lib/api';

export default function EventPlayerProfileModal({playerId,onClose,onSaved}:{playerId:number|null;onClose:()=>void;onSaved:()=>Promise<void>}) {
  const [form]=Form.useForm();
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if (!playerId) return;
    let active=true;
    setLoading(true);setReady(false);setError('');form.resetFields();
    api.get('/event/players/'+playerId+'/profile').then(response=>{
      if(active){form.setFieldsValue(response.data.data);setReady(true);}
    }).catch(e=>{if(active)setError(e?.response?.data?.error || '个人资料加载失败，请重试');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[playerId,form,retry]);
  async function save() {
    if(!playerId || saving || !ready)return;
    let values;
    try{values=await form.validateFields();}catch{return;}
    setSaving(true);setError('');
    try {
      await api.put('/event/players/'+playerId+'/profile',values);
      await onSaved();onClose();
    } catch(e:any){setError(e?.response?.data?.error || '保存失败，请重试');}
    finally{setSaving(false);}
  }
  return <Modal title="个人信息" open={playerId!==null} onCancel={()=>!saving&&onClose()} onOk={()=>void save()} confirmLoading={saving} okButtonProps={{disabled:loading||!ready}} cancelButtonProps={{disabled:saving}} okText="保存用户资料" cancelText="取消" width={640}>
    <Alert type="info" showIcon message="修改的是关联用户资料，姓名和手机号会同步到该用户的其他报名。" style={{marginBottom:16}}/>
    {error&&<Alert type="error" showIcon message={<span role="alert">{error}</span>} action={!ready?<Button onClick={()=>setRetry(n=>n+1)}>重试</Button>:undefined} style={{marginBottom:16}}/>}
    <Spin spinning={loading}>
      <Form form={form} layout="vertical" disabled={saving||loading||!ready}>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="name" label="姓名" rules={[{required:true,whitespace:true,message:'请填写姓名'},{max:120,message:'姓名最多120个字符'}]}><Input maxLength={120} placeholder="支持中文、英文和空格"/></Form.Item></Col>
          <Col span={12}><Form.Item name="phone" label="手机号" rules={[{required:true,message:'请填写手机号'}]}><Input maxLength={30} placeholder="国际号码需含区号"/></Form.Item></Col>
          <Col span={12}><Form.Item name="gender" label="性别"><Select allowClear options={['女','男','其他'].map(value=>({value,label:value}))}/></Form.Item></Col>
          <Col span={12}><Form.Item name="birthday" label="生日"><Input type="date"/></Form.Item></Col>
          <Col span={12}><Form.Item name="country" label="国家/地区"><Input maxLength={60}/></Form.Item></Col>
          <Col span={12}><Form.Item name="province" label="省份"><Input maxLength={60}/></Form.Item></Col>
          <Col span={12}><Form.Item name="city" label="城市"><Input maxLength={100}/></Form.Item></Col>
          <Col span={12}><Form.Item name="foreignRegion" label="境外地区"><Input maxLength={100}/></Form.Item></Col>
        </Row>
        <Form.Item name="address" label="详细地址"><Input maxLength={300}/></Form.Item>
        <Form.Item name="remark" label="备注"><Input.TextArea maxLength={1000} rows={2}/></Form.Item>
      </Form>
    </Spin>
  </Modal>;
}
