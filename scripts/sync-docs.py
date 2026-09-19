from pathlib import Path
from datetime import datetime,timezone
import json
root=Path(__file__).resolve().parents[1]
r=json.loads((root/'.agent-monitor/reports/coordinator.json').read_text())
now=datetime.now(timezone.utc)
def clean(value):
 return str(value or '미확인').replace('|','/').replace('\n',' ')
lines=['# 작업 계획','','최초 시작부터 최대 3시간. 마감 2026-09-19T14:42:37Z (한국시간23:42).','정의된 작업 수 기반 집계이며 난이도·시간 진행률을 뜻하지 않습니다.','','| ID | 작업 | 담당 | 선행 | 구현 | 검증 | 통합 |','|---|---|---|---|---|---|---|']
for t in r['tasks']:
 lines.append('| '+' | '.join(clean(x) for x in [t['id'],t.get('summary'),t.get('owner'),','.join(t.get('dependsOn',[])) or '없음',t.get('implementation'),t.get('verification'),t.get('integration')])+' |')
(root/'PLAN.md').write_text('\n'.join(lines)+'\n')
lines=['# 현재 상태','',f"실행: {r['run']['id']}",f"메인 세션: {r['run']['sessionId']} (환경변수 직접 확인)",f"시작: {r['run']['startedAt']}",f"마감: {r['run']['deadlineAt']}",f'최근 기록: {now.isoformat()}',f"현재 단계: {r['phase']}",'','## 관찰 범위','현재 메인 세션과 메인이 생성한 하위 에이전트만 관찰. 전체 PC 관찰 아님.','실제 모델·추론 강도, 열린/닫힌 하위 스레드 수, 비용·토큰은 확인 불가.','요청 모델은 실제 생성 도구의 인자로 지정. runtime은 main의 collaboration.list_agents 호출시만 재관측.','대시보드 2초 heartbeat는 에이전트 활동을 의미하지 않음. 오래된 관측은180초 후 표기.','설정하위1000 / 도구고지runtime총1001(메인포함),최대실측미확인. 사용자하위상한1000; 임의운영목표없음. ready독립작업즉시배정. PARALLEL_POLICY.md 참조. 공유디렉터리 파일소유권분리.','','## 최근 주요 기록']
for e in r['events'][-8:]:lines.append('- '+clean(e.get('message')))
lines+=['','## 다음 작업','PLAN.md의 독립 ready 작업을 즉시 병렬 배정하고 완료부터 검토·통합. 최종검증은 소스버전고정 후 시행.','게임 http://127.0.0.1:4173/ (화면 연결 중이면 검증완료 링크 전까지 미검증).','대시보드 http://127.0.0.1:4310/ . 재시작 .agent-monitor/README.md.','', '기존 사용자 .codex/config.toml 보존. 최초 폴더는 Git저장소 아님. 로컬gitinit만 수행, 외부공개 없음.']
(root/'STATUS.md').write_text('\n'.join(lines)+'\n')
