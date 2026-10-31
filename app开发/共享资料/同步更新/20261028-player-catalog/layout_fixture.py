"""Loopback-only 53-lesson layout fixture. Never calls production or issues media access."""
import importlib.util, os
from pathlib import Path
from urllib.parse import urlsplit
from http.server import ThreadingHTTPServer
source=Path(os.environ['EVA_SOURCE_ROOT'])/'app开发/iOS/EvaDance/scripts/fixture_server.py'
spec=importlib.util.spec_from_file_location('swod_fixture',source)
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
base.series[0].update(name='本地布局验收 · 53 节',total_courses=53,description='仅用于目录分页、搜索、文字换行和空状态验收，不连接生产服务。')
class Handler(base.Handler):
 def dispatch(self):
  path=urlsplit(self.path).path.removeprefix('/api/app/v1')
  if self.command=='GET' and path=='/public/series/1/detail':return self.reply(base.series[0])
  if self.command=='GET' and path=='/public/series/1/courses':
   return self.reply([dict(id=10,name='测试单元 · 基础训练',videos=[dict(id=100+i,name=f'第{i+1}课 · 理论与动作练习'+('《核心稳定力与发力训练的基础原理及组合应用》' if i%3==1 else ''),duration=435+i*7) for i in range(53)])])
  if self.command=='GET' and path=='/public/series/1/progress':
   if not self.headers.get('Authorization'):return self.reply(status=401,message='请登录')
   return self.reply([dict(video_id=100+i,duration=435+i*7,progress=(435+i*7)*(i%4)/10,completed=0) for i in range(53)])
  return super().dispatch()
print('Local layout fixture 127.0.0.1:18766; production disabled',flush=True)
ThreadingHTTPServer(('127.0.0.1',18766),Handler).serve_forever()
