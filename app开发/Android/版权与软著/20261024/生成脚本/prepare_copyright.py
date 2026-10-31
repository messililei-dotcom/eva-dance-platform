from pathlib import Path
import json,hashlib,zipfile,shutil,math,re,os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from docx import Document
from docx.shared import Cm,Pt,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
B=Path(__file__).resolve().parents[1];ROOT=B.parents[3];P=ROOT/'app开发/Android/EvaDance';RELEASE=ROOT/'app开发/Android/发布准备包/20261024'
NAME='SWOD东方舞学习服务软件';VER='1.0.0';COMPANY='伊娃文化艺术发展（湖南）有限公司'
FONT='/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
pdfmetrics.registerFont(TTFont('Uni',FONT))

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def wrap(text,width=480,size=11):
 out=[];line=''
 for char in text.replace('\t','    '):
  if line and pdfmetrics.stringWidth(line+char,'Uni',size)>width:out.append(line);line=''
  line+=char
 if line or not out:out.append(line)
 return out

def header(c,title,page,total):
 c.setFont('Uni',9);c.drawString(48,804,NAME+' '+VER);c.drawRightString(547,804,f'{title}   第 {page} 页 / 共 {total} 页');c.line(48,795,547,795)

def paged_pdf(path,rows,rows_per_page=35,size=11,title='操作说明书'):
 pages=[rows[i:i+rows_per_page] for i in range(0,len(rows),rows_per_page)]
 c=canvas.Canvas(str(path),pagesize=A4);c.setTitle(NAME+' '+VER+' '+title)
 for i,part in enumerate(pages,1):
  header(c,title,i,len(pages));c.setFont('Uni',size)
  for j,line in enumerate(part):c.drawString(50,770-j*(690/rows_per_page),line)
  c.showPage()
 c.save();return len(pages)

def doc():
 d=Document();s=d.sections[0];s.page_width=Cm(21);s.page_height=Cm(29.7);s.top_margin=s.bottom_margin=Cm(2.1);s.left_margin=s.right_margin=Cm(2.3)
 for n in ['Normal','Title','Heading 1','Heading 2']:
  st=d.styles[n];st.font.name='Arial Unicode MS';st._element.rPr.rFonts.set(qn('w:eastAsia'),'Arial Unicode MS');st.font.color.rgb=RGBColor(0,0,0)
 d.styles['Normal'].font.size=Pt(11);d.styles['Normal'].paragraph_format.space_after=Pt(6);d.styles['Normal'].paragraph_format.line_spacing=1.2
 d.styles['Title'].font.size=Pt(20);d.styles['Heading 1'].font.size=Pt(14)
 h=s.header.paragraphs[0];h.text=NAME+' '+VER;h.style='Normal';h.runs[0].font.size=Pt(9)
 f=s.footer.paragraphs[0];f.alignment=2;f.add_run('第 ');fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');f._p.append(fld);f.add_run(' 页')
 return d

# Only first-party Android application program files. No tests, SDK libraries, backend or secrets.
paths=sorted((P/'app/src/main/java').rglob('*.java'))+sorted((P/'app/src/main/res').rglob('*.xml'))+[P/'app/src/main/AndroidManifest.xml']
paths=[p for p in paths if not p.name.startswith('._')]
source_dir=B/'软著登记/源程序原件';source_dir.mkdir(exist_ok=True)
files=[];rows=[];mapping=[]
for p in paths:
 relative=p.relative_to(P);dest=source_dir/relative;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
 lines=p.read_text().splitlines();files.append({'path':relative.as_posix(),'sha256':sha(p),'physicalSourceLines':len(lines),'nonemptySourceLines':sum(bool(x.strip()) for x in lines)})
 # File identity is not inserted into executable source; PDF navigation rows are clearly labelled.
 rows.append('// FILE: '+relative.as_posix());mapping.append({'path':relative.as_posix(),'originalLine':None,'type':'file_separator'})
 for num,line in enumerate(lines,1):
  if not line.strip():continue
  for part_num,part in enumerate(wrap(line,490,9)):
   rows.append(part);mapping.append({'path':relative.as_posix(),'originalLine':num,'wrappedPart':part_num})
source_pages=paged_pdf(B/'软著登记/源程序完整排版.pdf',rows,50,9,'源程序')
from pypdf import PdfReader,PdfWriter
r=PdfReader(B/'软著登记/源程序完整排版.pdf');w=PdfWriter();selected=list(range(len(r.pages))) if len(r.pages)<=60 else list(range(30))+list(range(len(r.pages)-30,len(r.pages)))
for i in selected:w.add_page(r.pages[i])
with (B/'软著登记/源程序交存.pdf').open('wb') as f:w.write(f)
manifest={'asOf':'2026-10-24','softwareFullName':NAME,'shortName':'SWOD','version':VER,'androidVersionCode':7,'scope':'Android client first-party Java and XML only; excludes backend and third-party runtime code','sourceFiles':files,'totalOriginalLines':sum(f['physicalSourceLines'] for f in files),'nonemptyOriginalLines':sum(f['nonemptySourceLines'] for f in files),'pdfVisualRows':len(rows),'pdfOriginalPages':source_pages,'submissionPageIndicesOneBased':[i+1 for i in selected],'selection':'all pages because fewer than 60' if source_pages<60 else 'first 30 and last 30 pages','originalsUnmodified':True,'lineWrapping':'PDF presentation soft-wraps existing long lines; no filler or duplicated source','apkSHA256':sha(RELEASE/'installers/SWOD-1.0.0-7-release.apk')}
(B/'内部核验/源程序清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(B/'内部核验/源码排版映射.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n')
with zipfile.ZipFile(B/'软著登记/源程序原件.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in paths:z.write(p,p.relative_to(P))

sections=[
('软件概述',[
'本说明书对应SWOD东方舞学习服务软件1.0.0，简称SWOD，安卓候选构建号为7。软件面向东方舞课程学习、线下课程与赛事服务使用者，由伊娃文化艺术发展（湖南）有限公司运营。',
'软件采用原生Android界面，分为线上学院、线下课、赛事、商城和个人中心五个主要栏目。公开目录可由游客浏览；课程学习、个人资料、订单、比赛与证书记录由服务端核验登录会员后返回。',
'软件依赖运营方业务服务器提供公开内容和个人服务，需要可用互联网连接。网页内容通过外部官网入口打开，不以网页页面冒充原生播放器或原生会员服务。',
'本说明仅描述已实现的功能。当前版本未开放原生线上数字课程支付、实体商品结账、离线视频下载、号码一键登录或微信移动登录。课程学习依赖已存在的有效授权。']),
('运行环境和安装',[
'运行设备为Android 8.0及以上的安卓手机；目标Android SDK为36。界面支持系统字号、深色主题以及不同屏幕宽度，具体设备兼容性以实际测试为准。',
'通过经核验的正式签名APK安装软件，安装完成后桌面名称显示SWOD。正式渠道的安装包包名为cn.com.swod.app，切勿安装来源不明或重新打包的同名应用。',
'首次启动需要阅读隐私提示。点击阅读隐私政策或服务条款可在本机查看对应文本；拒绝时退出软件；同意后开始加载业务目录和图片。',
'本版本仅声明网络访问权限，不申请短信读取、相机、录音、定位、通讯录或全盘文件访问权限。选择赛事音乐使用系统文件选择器，不能据此获取其他未主动选择的文件。',
'安装失败时检查系统版本、可用空间与安装包完整性，不要绕过系统安全警告。覆盖升级必须使用相同发布签名且版本号符合系统要求；政策版本更新后重新提示同意。']),
('导航和公开浏览',[
'启动后进入线上学院，可使用底部的线上学院、线下课、赛事、商城、我的切换栏目。顶部提供返回与刷新操作，长页面可以上下滚动。',
'公开页面展示课程、赛事、商品等由运营服务器提供的信息。目录暂无数据时显示空状态；请求失败时显示错误信息和重试入口，不把网络错误当作购买成功或授权结果。',
'页面切换后过期请求不应覆盖当前页面。若登录状态失效，个人功能提示重新登录；刷新当前页面可重新向服务端查询，不能将前一会员的个人权益用于当前游客。',
'官网内容入口使用HTTPS打开系统浏览器。离开软件查看外部页面后可返回软件继续使用，外部页面的信息处理以其自身政策为准。']),
('会员登录和退出',[
'在我的栏目选择手机号登录，输入本人手机号和短信验证码，阅读并勾选隐私政策与服务条款后登录。获取验证码前也需要同意相关文本，软件不读取手机短信。',
'已有密码的会员可选择切换为密码登录，填写手机号和已设置的会员密码。密码输入为遮蔽显示，软件不会把输入密码内置到安装包或持久保存为明文。',
'未设置密码的会员可返回短信登录；软件不提供绕过验证码的通用密码。审核人员使用受控审核会员，该账号不获得工作人员管理权限。',
'手机号格式无效、验证码不是六位或密码为空时，输入框显示对应错误并将焦点返回待修正字段。未同意协议不能提交登录，请按实际错误提示修正。',
'登录凭证经服务端验证后保存到由Android Keystore保护的本地凭证容器，用于访问个人服务。会话续期、失效与设备撤销均由服务端控制，不信任请求自行声明的会员身份。',
'在个人中心选择退出登录并确认，清除本机登录并撤销对应会话。切换账号时重新加载当前会员数据，之前账号的课程、订单和学习记录不得沿用。']),
('线上学院和学习权益',[
'线上学院展示课程名称、老师、封面、课程信息与目录入口。用户可查看详情、搜索课程或在课节目录检索，课节较多时按页浏览。',
'未登录或没有有效权益时正常展示适用价格及课程介绍。有效线上学习权益必须由服务端按照已验证会员查询，并使用后台课程series ID识别，不以同号商品或线下课替代。',
'已解锁课程显示绿色的已解锁标识，隐藏价格、原价、优惠价及购买操作，学习操作使用立即学习或继续学习。个人中心的对应入口统一为我的课程。',
'若权益查询失败，显示重新查询学习权益等重试入口，不误标为已解锁，也不在无法确认时诱导用户重复购买。权益失效或被撤销后以服务端重新验证结果为准。',
'在课程详情选择继续学习或查看课程目录，进入课节列表。课节卡片可显示名称、时长、学习百分比及当前课节，定位当前可返回之前选择的课节。',
'目录中的价格显示不能替代支付功能开放状态。当前版本不提供新增线上数字课程的原生支付，不伪造已支付订单或使用未支付订单作为学习授权。']),
('视频播放和学习记录',[
'选择课节后，播放器先读取当前会员的进度并请求播放授权。只有授权有效且返回安全播放地址时才加载课程媒体，匿名用户或无权账号不能播放受保护课节。',
'播放器支持播放、暂停、拖动以及继续之前的学习位置。学习位置按具体课节记录，服务端验证当前账号和权益，不能靠修改客户端会员ID获取其他人的资源。',
'播放器在适当时机保存学习进度。若另一设备已更新进度并发生版本冲突，显示提示并重新获取状态，避免旧进度覆盖较新的记录。',
'学习笔记和书签属于当前会员私有内容，用户可在个人中心查看并跳转至课节位置。新增或删除操作只处理当前已验证账号拥有的学习记录。',
'网络不可用、媒体地址失效或服务暂时不可用时，按错误提示返回并重试。真实长视频、移动网络切换和前后台连续播放需要在实际手机上验收，接口采样不代表已完成该验收。']),
('线下课程服务',[
'线下课栏目提供课程说明、老师、地点与期次信息。线下服务按购买的期次课时及实际到课核销规则展示，不将课程名称相同视为线上学习权益。',
'已登录会员可在我的线下课时查看个人期次、剩余课时与核销记录。记录来自服务端，不以客户端缓存或用户自行输入的剩余次数作为核销依据。',
'同一个数字ID出现在不同业务域时，线下课、商品和线上课程仍相互区分。线上课程授权不意味着已购买线下课，线下期次也不直接解锁线上视频。',
'实际到课或核销需依工作人员权限及服务端规则处理。普通会员查看记录不取得修改运营记录、替他人签到或工作人员管理权限。']),
('赛事和我的比赛',[
'赛事栏目可浏览真实赛事介绍、赛程、分组和已发布的信息。用户可使用搜索查找活动并进入详情，未发布成绩不得作为已公布结果显示。',
'本人报名和比赛记录在个人中心的我的比赛查看，相关卡片可显示报名人、组别、选手号、节目名称、审核状态、缴费状态及已发布结果。',
'按赛事开放规则允许的入口提交节目资料和音乐。所选文件由系统文件选择器提供，客户端限制音乐大小，服务端还会校验文件格式、实际可解码性和提交归属。',
'参赛选手可能与代提交的会员不同，服务端区分选手身份和经过验证的提交者身份。请求夹带其他会员ID不构成授权，报名权限及重复提交由服务器核验。',
'赛事满额、关闭报名、重复报名或资料校验失败时按提示处理。不要通过修改客户端重试参数绕过名额限制，也不要为测试产生真实付费、退款或公开报名。']),
('商城和个人服务',[
'商城显示商品、分类、规格及适用价格，用户可查看已有商城订单、物流和售后信息。当前版本未开放原生结账与支付，不应将商品浏览宣传为已完成购买。',
'个人中心提供个人资料、学习统计、我的课程、我的线下课时、我的比赛、订单、证书、学习笔记、书签、成长档案和登录设备等入口。',
'个人资料只允许修改客户端开放的字段。手机号、身份、工作人员备注、会员等级等服务端管理字段不能由客户端自行覆盖。',
'证书、订单、地址及比赛资料可能包含个人信息，只能在当前已验证会员和权限范围内查询。个人响应禁止进入共享缓存，退出后清理本地会话。',
'工作人员赛事管理使用独立账号与服务端授权，普通会员密码登录不进入管理会话。操作前需确认当前入口和权限，不共享工作人员凭证。']),
('隐私设置和账号注销',[
'在个人中心进入关于SWOD，可核对软件版本、运营主体、App备案号并阅读隐私政策、服务条款和服务商数据清单。备案号为湘ICP备2026005683号-5A。',
'选择撤回隐私授权并确认后，清除本机登录与同意状态，返回首次提示；撤回授权不会直接注销服务器会员，也不能等同已删除所有依法留存记录。',
'注销账号需要验证当前账号手机号，提交后进入平台处理流程并撤销会话。申请状态、实际处理结果和依法保留信息按服务器规则执行，软件不承诺申请即瞬间删除。',
'不要使用正式运营账号或仍供其他渠道审核的受控账号测试最终注销。需要实测时使用独立、明确可注销的测试会员，并按实际结果记录验收。',
'隐私政策网址为https://www.swod.com.cn/app/privacy.html。服务支持入口为https://www.swod.com.cn/contact，用户可通过公布渠道反馈账号、课程或隐私问题。']),
('技术实现和错误处理',[
'客户端主要由Java实现，采用Android原生Activity、视图、媒体播放和系统文件选择能力。开发工具为JDK17、Gradle8.13、Android Gradle Plugin8.13.2。',
'会员请求使用运营方HTTPS业务接口，网络传输与页面状态分离。后台承担身份验证、学习权益、播放授权、私有记录和业务规则校验，客户端隐藏按钮不能替代服务器授权。',
'本机策略文件可离线读取，网络功能等待用户同意后初始化。凭证通过Keystore加密，本版本关闭应用备份和数据迁移导出，避免会话明文外流。',
'当前客户端没有生产第三方广告、统计、推送、号码认证或微信登录SDK。短信和媒体点播由服务端按实际请求接入，不能把服务端处理者误填为客户端集成SDK。',
'出现请求失败时重试或重新登录；出现权限失效时重新向服务端核验；出现进度冲突时先更新当前状态。所有错误处理都不应跳过身份验证或伪造成功。',
'文档描述范围为当前安卓候选版本，不包含其他端源代码、服务器程序、课程音视频及第三方独立作品的著作权。登记材料不替代课程内容、音乐、图标或商标的合法授权。'])]

# A complete text identification document: 35 nonempty typeset lines/page except last.
manual_rows=[]
for title,paras in sections:
 manual_rows.append(title)
 for para in paras:manual_rows.extend(wrap(para))
manual_pages=paged_pdf(B/'软著登记/操作说明书交存.pdf',manual_rows,title='操作说明书')
(B/'软著登记/操作说明书.txt').write_text(NAME+' '+VER+' 操作说明书\n\n'+'\n\n'.join(title+'\n'+'\n'.join(paras) for title,paras in sections)+'\n')
d=doc();d.add_paragraph(NAME+'操作说明书','Title');d.add_paragraph('版本 '+VER+'   安卓构建 7');d.add_paragraph('本说明书依据实际候选包、源程序和已有验证记录编写，描述已实现功能及使用条件。')
for title,paras in sections:
 d.add_heading(title,level=1)
 for para in paras:d.add_paragraph(para)
d.save(B/'软著登记/操作说明书.docx')

fields={'softwareFullName':NAME,'softwareShortName':'SWOD','softwareVersion':VER,'androidBuild':7,'copyrightOwner':COMPANY,'ownerType':'企业法人','unifiedSocialCreditCode':'91430103MADKK5FY5T','country':'中国','province':'湖南省','city':'长沙市','registeredAddress':'湖南省长沙市天心区暮云街道万家丽南路二段896号创世纪金街一区2-03栋203','developmentModeDraft':'单独开发（用户确认公司开发；正式提交前确认有无合作或委托关系）','rightsAcquisitionDraft':'原始取得','rightsScopeDraft':'全部权利（正式确认签章前核对）','completionDateDraft':'2026-10-24','completionDateBasis':'本次申请版本实际固定及验证日期；用户仅授权今年任意日期，未以此作为历史日期事实','completionDateFinalConfirmed':False,'publicationStatus':None,'firstPublicationDate':None,'firstPublicationPlace':None,'previousRegistrationNumber':None,'applicationMethod':'著作权人自行办理','contactName':'李雷','contactPhone':'13548955558','contactEmail':'messi.lilei@gmail.com','programmingLanguages':['Java','XML'],'sourceLineCount':manifest['totalOriginalLines'],'sourceLineCountScope':manifest['scope'],'developmentEnvironment':'macOS，JDK 17，Gradle 8.13，AGP 8.13.2，Android SDK 36','runtimeEnvironment':'Android 8.0或以上；互联网连接；运营方HTTPS服务','hardwareRequirementsDraft':'Android兼容手机；具体CPU、内存及存储要求以实机结果确认，尚未声明最低容量','developmentPurpose':'为东方舞会员提供课程学习、线下课时、赛事记录及相关个人服务。','industry':'文化艺术培训及学习服务','mainFunctions':'课程目录及授权视频学习、进度笔记书签、线下课程期次和课时查询、赛事与我的比赛、商品及已有订单、个人资料证书和设备管理。','technicalFeatures':'原生Android界面；服务端身份与课程权益独立校验；Keystore加密会话；HTTPS通信；首启政策同意和撤回；个人数据隔离。','officialAccountLoginVerified':False,'submitted':False,'certificateIssued':False}
(B/'软著登记/申请字段待确认.json').write_text(json.dumps(fields,ensure_ascii=False,indent=2)+'\n')
d=doc();d.add_paragraph('SWOD 软件著作权登记申请字段准备稿','Title');d.add_paragraph('拟登记版本 '+VER+'   准备日期 2026年10月24日')
d.add_paragraph('此文件用于在线填表前核对，不是版权保护中心生成的申请确认签章页，不能直接盖章冒充官方表格。正式确认签章页须在系统填报后原样打印、盖鲜章并扫描上传。')
labels=[('软件全称',NAME),('软件简称','SWOD'),('版本号',VER),('著作权人',COMPANY),('主体类别','企业法人'),('统一社会信用代码',fields['unifiedSocialCreditCode']),('国籍及地区','中国 湖南省 长沙市'),('注册地址',fields['registeredAddress']),('开发方式',fields['developmentModeDraft']),('权利取得方式',fields['rightsAcquisitionDraft']),('权利范围',fields['rightsScopeDraft']),('开发完成日期','拟填2026-10-24，提交前确认，不任意倒填'),('发表状态','待确认；未公开上架不必然等于未发表'),('首次发表日期和地点','发表状态确认后填写；未发表时不填写日期'),('编程语言','Java、XML'),('源程序量',str(fields['sourceLineCount'])+'行，统计范围为本次Android自有程序文件，详见清单'),('软件环境',fields['developmentEnvironment']),('运行环境',fields['runtimeEnvironment']),('硬件环境',fields['hardwareRequirementsDraft']),('开发目的',fields['developmentPurpose']),('主要功能',fields['mainFunctions']),('技术特点',fields['technicalFeatures']),('申请方式','著作权人自行办理'),('联系人','李雷 13548955558 messi.lilei@gmail.com')]
for k,v in labels:
 p=d.add_paragraph();p.add_run(k+'：').bold=True;p.add_run(v)
d.add_heading('提交前待确认事实',1);d.add_paragraph('请确认该申请版本实际完成日、首次公开发表情况，以及公司全部权利和开发关系。若存在合作、委托或受让，应提供实际合同，不补造历史协议。')
d.add_heading('已准备的附件',1);d.add_paragraph(f'源程序交存PDF共{len(selected)}页，操作说明书交存PDF共{manual_pages}页，程序原件ZIP及哈希清单。营业执照原件已存在独立资质目录。签章页待官方系统生成。')
d.save(B/'软著登记/申请字段准备稿.docx')

# A factual ownership explanation, expressly not a substitute for a required certificate.
d=doc();d.add_paragraph('SWOD 安卓应用研发及权属情况说明草稿','Title');d.add_paragraph('供公司核对和平台补充说明使用  未签章')
for para in [f'应用名称SWOD，包名cn.com.swod.app，版本{VER}（7），运营主体为{COMPANY}，统一社会信用代码91430103MADKK5FY5T。App备案号湘ICP备2026005683号-5A。',
'据公司提供的信息，本软件由公司组织开发。拟以公司名义申请本软件的全部著作权；实际开发关系及权利范围应由公司在签章前核对确认。',
'截至2026年10月24日，公司尚未提供本软件的计算机软件著作权登记证书、APP电子版权证书或软件著作权认证证书。本说明不含登记证书编号，不宣称已获认证。',
'所附程序清单、精确安装包哈希、操作说明书及真实运行截图用于说明软件与主体、包名、版本之间的对应关系。上述材料不替代平台明确要求的版权证书，也不证明课程音视频或其他独立作品的全部权属。',
'如平台当前表单允许在证书非必选情况下提交补充说明，可在核实要求后使用；如要求证书，应取得被接受的有效证书后再提交，不以本说明占填证书栏位。',
'公司应在签章前审阅以上事实；如发现委托开发、共同权利人或其他权利限制，应补充真实证明并修正。',
'公司盖章：____________________', '签署日期：______年____月____日']:
 d.add_paragraph(para)
d.save(B/'待签章/研发及权属情况说明草稿.docx')

# The alternative is a separately issued electronic certificate, not a home-made certificate.
shutil.copy2(B/'软著登记/操作说明书.docx',B/'电子版权备选/操作说明书.docx')
shutil.copy2(B/'软著登记/操作说明书交存.pdf',B/'电子版权备选/操作说明书交存.pdf')
shutil.copy2(B/'软著登记/源程序交存.pdf',B/'电子版权备选/源程序交存.pdf')
(B/'电子版权备选/申请资料清单.json').write_text(json.dumps({'provider':'易版权（腾讯官方版权说明页链接指向的服务商）','serviceURL':'https://www.yibanquan.com.cn/product/cc.at','service':'APP软著认证电子版权（无需既有软著登记证书）','observedPriceCNY':600,'observedReferenceDays':'10-15个工作日','observedAt':'2026-10-24','requirements':{'businessLicense':'已定位原始照片，尚未向此服务商提交','operatorID':'服务商页面要求经办人身份证；尚未向此服务商提交','manual':'已准备','source':'已准备，少于60页全部交存，须以服务商实际填报要求为准'},'paid':False,'orderCreated':False,'termsAccepted':False,'dataUploaded':False,'issuedCertificate':False},ensure_ascii=False,indent=2)+'\n')
(B/'内部核验/生成结果.json').write_text(json.dumps({'sourcePages':source_pages,'sourceSubmissionPages':len(selected),'manualPages':manual_pages,'originalCodeLines':manifest['totalOriginalLines'],'sourceVisualRows':len(rows),'manualRows':len(manual_rows),'docxA4ForRegistration':True,'draftFieldsStillUnconfirmed':['completionDate','publicationStatus','rightsScope']},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sourcePages':source_pages,'manualPages':manual_pages,'originalLines':manifest['totalOriginalLines'],'sourceVisualRows':len(rows)},ensure_ascii=False))
