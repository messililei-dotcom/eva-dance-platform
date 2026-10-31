"""Validate the existing reviewer credential; never print password or tokens."""
import json,urllib.request,urllib.error,pathlib,datetime
BASE='https://admin.swod.com.cn/api/app/v1'
pw=(pathlib.Path.home()/'.config/eva-app/review-password.recovered.txt').read_text().strip()
def call(path,body=None,token=None):
 headers={'Content-Type':'application/json','x-client-platform':'harmony','Cache-Control':'no-store'}
 if token:headers['Authorization']='Bearer '+token
 data=None if body is None else json.dumps(body).encode()
 req=urllib.request.Request(BASE+path,data=data,headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=25) as response:return response.status,json.load(response)
 except urllib.error.HTTPError as ex:
  return ex.code,{'success':False}
status,payload=call('/auth/password-login',{'phone':'13548955558','password':pw,'deviceName':'SWOD HarmonyOS pre-submit QA'})
d=payload.get('data') or {};token=d.get('token');result={'checkedAt':datetime.datetime.now().astimezone().isoformat(),'loginHTTP':status,'loginSuccess':payload.get('success') is True,'credentialShapeValid':all(d.get(k) for k in ['token','refreshToken','memberId','sessionId']),'expectedReviewer':d.get('memberId')==859,'passwordChanged':False,'tokensRecorded':False,'existingSessionsRevoked':False}
try:
 if token:
  hs,rights=call('/member/authorized-series',token=token);result['entitlementHTTP']=hs;result['entitlementResponseSuccess']=rights.get('success') is True
finally:
 if token:result['qaSessionLogoutHTTP']=call('/auth/logout',{},token)[0]
print(json.dumps(result,ensure_ascii=False))
assert result['loginHTTP']==200 and result['loginSuccess'] and result['credentialShapeValid'] and result['expectedReviewer'],'review login failed'
