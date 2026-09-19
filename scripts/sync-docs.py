from pathlib import Path
from datetime import datetime,timezone
import json
root=Path(__file__).resolve().parents[1]
r=json.loads((root/'.agent-monitor/reports/coordinator.json').read_text())
now=datetime.now(timezone.utc)
def clean(value):
 return str(value or '미확인').replace('|','/').replace('\n',' ')
lines=['# 작업 계획','','최초 시작부터 최대 3시간. 마감 2026-09-19T14:42:37Z (한국시간23:42).','정의된 작업 수 기반 집계이며 난이도·시간 진행률을 뜻하지 않습니다.','','| ID | 작업 | 담당 | 상태 | 선행 | 구현 | 검증 | 통합 |','|---|---|---|---|---|---|---|---|']
for t in r['tasks']:
 lines.append('| '+' | '.join(clean(x) for x in [t['id'],t.get('summary'),t.get('owner'),t.get('status'),','.join(t.get('dependsOn',[])) or '없음',t.get('implementation'),t.get('verification'),t.get('integration')])+' |')
lines += ['', '## 소유권과 연결 계약', '', '| ID | 파일·산출물 | 인터페이스 | 요청 모델·추론 | 검증 방법 | 통합 담당 |', '|---|---|---|---|---|---|']
for t in r['tasks']:
 lines.append('| '+' | '.join(clean(x) for x in [t['id'], ', '.join(t.get('files',[])), t.get('interface'), str(t.get('requestedModel','미확인'))+' '+str(t.get('requestedReasoning','')),t.get('verificationMethod'),t.get('integrator')])+' |')
(root/'PLAN.md').write_text('\n'.join(lines)+'\n')
lines=['# 현재 상태','',f"실행: {r['run']['id']}",f"메인 세션: {r['run']['sessionId']} (환경변수 직접 확인)",f"시작: {r['run']['startedAt']}",f"마감: {r['run']['deadlineAt']}",f'최근 기록: {now.isoformat()}',f"현재 단계: {r['phase']}",'','## 관찰 범위','현재 메인 세션과 메인이 생성한 하위 에이전트만 관찰. 전체 PC 관찰 아님.','실제 모델·추론 강도, 열린/닫힌 하위 스레드 수, 비용·토큰은 확인 불가.','요청 모델은 실제 생성 도구의 인자로 지정. runtime은 main의 collaboration.list_agents 호출시만 재관측.','대시보드 2초 heartbeat는 에이전트 활동을 의미하지 않음. 오래된 관측은180초 후 표기.','설정하위1000 / 도구고지runtime총1001(메인포함),최대실측미확인. 사용자하위상한1000; 임의운영목표없음. ready독립작업즉시배정. PARALLEL_POLICY.md 참조. 공유디렉터리 파일소유권분리.','','## 최근 주요 기록']
for e in r['events'][-8:]:lines.append('- '+clean(e.get('message')))
if r.get('mode')=='final':
 lines+=['','## 완료와 재실행',f"완료 기록 시각: {r.get('finalizedAt')}",'요청된 범위의 구현·통합·필요 검증을 마쳤습니다. 결과와 미검증 환경은 VALIDATION.md 참조. 최종 대시보드는 마지막 직접 관측을 보존하며 이후 실제 실행을 감시한다고 주장하지 않습니다.','새 요청이 없으면 추가 에이전트·반복 검증을 시작하지 않습니다.']
else:
 lines+=['','## 다음 작업','PLAN.md의 독립 ready 작업을 즉시 배정하고 완료부터 검토·통합. 남은 실제 플레이·최종 성능 계측은 고정 버전으로 수행.']
lines+=['','게임 http://127.0.0.1:4174/ (프로덕션 미리보기). 개발 http://127.0.0.1:4173/ .','대시보드 http://127.0.0.1:4310/ . 재시작 .agent-monitor/README.md 및 RUNBOOK.md.','', '기존 사용자 .codex/config.toml 보존. 최초 폴더는 Git저장소 아님. 로컬gitinit만 수행, 외부공개 없음.']
(root/'STATUS.md').write_text('\n'.join(lines)+'\n')
