"""Local UI fixtures only. Binds loopback; never calls production or sends SMS.
Run with bundled Python, then DEBUG EVA_API_BASE=http://127.0.0.1:18765/api/app/v1.
These fixtures are not a replacement for backend integration tests.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
import json,time
series=[dict(id=1,name='东方舞基础训练',subtitle='从基本功到组合',teacher='测试老师',category='基础',description='本地演示数据，用于界面验收。',total_courses=2,cover_image=''),dict(id=2,name='舞台表现与成品舞',subtitle='节奏、表达与舞台',teacher='测试老师',total_courses=1,cover_image='')]
products=[dict(id='fixture-dress',name='练习舞裙',category='舞服',spec='练习款',size='M',color='酒红',priceFen=19900,stock=8,image='')]
notes=[];bookmarks=[]
profile=dict(id=1,name='测试学员',phone='13800000000',gender='女',birthday='',country='中国',province='湖南',city='长沙',address='长沙市测试街道1号',stats=dict(authorized_count=2,completed_count=1),growth={})
shipping=dict(recipient='测试学员',phone='13800000000',address='湖南省长沙市测试街道1号')
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):self.dispatch()
 def do_POST(self):self.dispatch()
 def do_PUT(self):self.dispatch()
 def do_PATCH(self):self.dispatch()
 def do_DELETE(self):self.dispatch()
 def reply(self,data=None,status=200,message=None):
  body=json.dumps(dict(success=status<400,**({'message':message} if message else {'data':data})),ensure_ascii=False).encode()
  self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def dispatch(self):
  path=urlsplit(self.path).path.removeprefix('/api/app/v1');method=self.command
  body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or '{}')
  if path=='/send-code':return self.reply({})
  if path in ['/auth/login','/auth/refresh']:
   if path.endswith('login') and (body.get('phone')!='13800000000' or body.get('code')!='123456'):return self.reply(status=400,message='测试账号为 13800000000 / 123456')
   return self.reply(dict(token='fixture-access',refreshToken='fixture-refresh',expiresAt=int(time.time()*1000)+900000,memberId=1,sessionId='fixture-device'))
  if path=='/public/series':return self.reply(series)
  if path.endswith('/courses') and path.startswith('/public/series/'):
   return self.reply([dict(id=10,name='基础站姿与重心',videos=[dict(id=100,name='第一节',duration=120)]),dict(id=11,name='肩胸分离练习',videos=[dict(id=101,name='第二节',duration=180)])])
  if path=='/public/offline-courses':return self.reply([dict(id=900001,source_id='1',name='长沙东方舞集训',subtitle='周末班',teacher='测试老师',description='本地线下课程演示',start_date='2026-10-10',end_date='2026-10-11',location='长沙',outline=['基本功','舞段练习'],cover_image='')])
  if path=='/events':return self.reply([dict(id=1,name='东方舞交流赛',startDate='2026-11-01',city='长沙')])
  if path=='/events/1':return self.reply(dict(competition=dict(id=1,name='东方舞交流赛',startDate='2026-11-01',venue='测试剧场',description='本地赛事验收样本'),groups=[dict(id=1,name='成人业余组')],rankings=[],sessions=[dict(id=1,name='预赛',startsAt='2026-11-01 10:00',venue='测试剧场')]))
  if path=='/shop/products':return self.reply(dict(products=products,payment=dict(ios=False)))
  if not self.headers.get('Authorization'):return self.reply(status=401,message='请登录')
  if path=='/member/profile':
   if method=='PUT':profile.update(body)
   return self.reply(profile)
  if path=='/member/authorized-series':return self.reply([dict(series_id=s['id'],series_name=s['name']) for s in series])
  if path=='/member/recent-courses':return self.reply([dict(video_id=100,course_name='基础站姿与重心',series_name='东方舞基础训练',progress=12)])
  if path=='/member/messages':return self.reply(dict(items=[dict(id='1',recipientId='9',title='课程更新',content='练习内容已更新。本条为本地测试消息。',status='unread',createdAt='2026-10-02')],unreadCount=1,nextCursor=0,hasMore=False))
  if path=='/certificates':return self.reply([dict(id=1,certificateNo='FIXTURE-001',courseName='基础训练结业',issueDate='2026-10-02',status='active',verifyUrl='')])
  if path=='/member/growth':return self.reply(dict(growth=dict(level_display='初学者',experience_total=120),ledger=[dict(id=1,description='完成练习',points_delta=10,occurred_at='2026-10-02')]))
  if path=='/offline/overview':return self.reply(dict(entitlements=[dict(id=1,course_name='周末集训',course_period='2026年10月',available_sessions=3,used_sessions=1)],consumes=[dict(id=1,course_name='周末集训',consume_date='2026-10-10',count=1)]))
  if path=='/shop/shipping':
   if method=='PUT':shipping.update(body)
   return self.reply(dict(shipping=shipping))
  if path=='/shop/orders':return self.reply(dict(orders=[dict(id='fixture-order',status='shipped',totalFen=19900,items=[dict(id=1,name='练习舞裙',quantity=1)])]))
  if path=='/shop/orders/fixture-order':return self.reply(dict(order=dict(id='fixture-order',status='shipped',totalFen=19900,**shipping,carrier='测试快递',trackingNo='FIXTURE-123',items=[dict(id=1,name='练习舞裙',quantity=1)])))
  if path=='/devices':return self.reply([dict(id='fixture-device',device_name='测试设备',current=True,created_at=0,last_seen=0)])
  if path=='/member/events':return self.reply(dict(entries=[dict(playerId='1',competitionName='东方舞交流赛',groupName='成人业余组',auditStatus='pending',totalScore=None)]))
  for kind,records in [('notes',notes),('bookmarks',bookmarks)]:
   if path=='/'+kind and method=='POST':records.append(dict(id=len(records)+1,course_name='基础站姿与重心',**body));return self.reply(dict(id=len(records)))
   if path=='/'+kind+'/all':return self.reply(records)
  if path.endswith('/play'):return self.reply(status=403,message='本地界面测试不签发生产视频权限')
  if method=='GET':return self.reply([])
  return self.reply(dict(changed=1,status='pending'))
if __name__=='__main__':
 print('UI fixture server: http://127.0.0.1:18765/api/app/v1 (no production access)',flush=True)
 ThreadingHTTPServer(('127.0.0.1',18765),Handler).serve_forever()
