"""Read-only release readiness check. Exits 2 until every gate has evidence."""
from pathlib import Path
import json, sys
from verify_filing_signature import verify
root = Path(__file__).resolve().parents[2]
state = json.loads((root/'注册与上架/发布状态.json').read_text())
blocked = []
if state.get('filingChangeAllowed') is False:
    try:
        report = verify(root / state['distributionIPA'], root / state['filedIdentityReference'])
        if not report['passed'] or report['certificateSHA1'] != state['requiredSigningCertificateSHA1']:
            blocked.append('最终安装包签名必须与已核验备案完全一致')
    except Exception:
        blocked.append('无法核验最终安装包与备案签名；禁止放行')
for gate in state['gates']:
    evidence = gate.get('evidence')
    if not gate.get('passed') or not evidence or not (root/evidence).is_file():
        blocked.append(gate['description'])
print('阶段：'+state['stage'])
for text in blocked: print('待完成：'+text)
print('未通过发布检查' if blocked else '资料门槛通过；仍需核对当前实际签名、上传与审核状态')
sys.exit(2 if blocked else 0)
