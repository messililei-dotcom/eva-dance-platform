"""Loopback-only navigation fixture. Never issues a playable URL or production token."""
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json,time
requests=[]
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def reply(self,data,status=200):
  raw=json.dumps({'success':status<400,'data':data} if status<400 else {'success':False,'message':'本地界面测试不签发生产视频权限'},ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
 def do_POST(self):
  self.rfile.read(int(self.headers.get('Content-Length',0)))
  if self.path=='/api/app/v1/auth/password-login':return self.reply(dict(token='fixture-direct-only',refreshToken='fixture-direct-refresh',expiresAt=int(time.time()*1000)+900000,memberId=900001,sessionId='fixture-direct-entry'))
  return self.reply({},403)
 def do_GET(self):
  path=self.path.removeprefix('/api/app/v1');requests.append(path)
  if path=='/qa/requests':return self.reply(requests)
  if path=='/member/authorized-series':return self.reply([dict(series_id=1,series_name='本地导航测试')])
  if path.endswith('/courses'):
   if '/2/' in path:return self.reply([])
   return self.reply([dict(name='本地导航测试',videos=[dict(id=100,name='本地测试第一节',duration=120),dict(id=101,name='本地测试第二节',duration=120)])])
  if path.endswith('/progress') and path.startswith('/public/series/'):
   return self.reply([dict(video_id=100,progress=5,duration=120,last_play_at='2026-10-29 10:00:00'),dict(video_id=101,progress=20,duration=120,last_play_at='2026-10-30 10:00:00')])
  if path.endswith('/play'):return self.reply({},403)
  return self.reply({})
ThreadingHTTPServer(('127.0.0.1',19876),Handler).serve_forever()
