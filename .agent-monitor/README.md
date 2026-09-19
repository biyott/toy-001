# 에이전트 작업 관제 대시보드

Python 표준 라이브러리만 사용하는 로컬 전용 수집기와 대시보드입니다. `127.0.0.1`에만 바인딩하고 지정된 화면·API 경로만 제공합니다. 저장소 파일이나 원본 세션 로그는 제공하지 않습니다.

화면의 한글은 저장소에 함께 둔 Noto Sans KR 400/700 WOFF2를 사용합니다. 글꼴 라이선스는 `assets/fonts/LICENSE`에 보존합니다.

## 실행과 확인

```bash
python3 .agent-monitor/collector.py
```

기본 포트는 `4310`입니다. 사용 중이면 `4311`부터 빈 포트를 찾습니다. 실제 URL과 PID는 `.agent-monitor/data/runtime.json`에 저장됩니다.

```bash
curl http://127.0.0.1:4310/health
curl http://127.0.0.1:4310/api/state
```

중지는 실행한 터미널에서 `Ctrl+C`를 누릅니다. 백그라운드 실행이면 `runtime.json`의 PID가 이 수집기인지 확인한 뒤 `kill PID`를 사용합니다. 종료 시 `.agent-monitor/data/final-state.json`에 최종 저장본을 남깁니다. 재실행하면 기존 이벤트를 읽고 ID로 중복을 제거합니다.

메인이 `coordinator.json`에 `"mode": "final"`과 `"finalizedAt": "..."`을 기록하면 살아 있는 단일 수집기가 관측시각을 그 시각으로 고정하고 최종 저장본을 원자 저장합니다. 화면 상단 연결 표시는 `최종 저장본`으로 바뀝니다.

## 입력과 관찰 범위

- `.agent-monitor/reports/coordinator.json`: 메인이 기록하는 배정 및 런타임 관측 결과. 수집기는 읽기만 합니다.
- `.agent-monitor/reports/*.json`: 에이전트별 직접 보고. 보고 기반임을 화면에 표시합니다.
- 동일 작업의 상태가 충돌하면 coordinator의 명시적 배정·검증·통합 판정을 우선합니다. 에이전트 보고의 다른 상태·결과·검증은 충돌 출처와 보고 증거로 보존하고 화면에 표시합니다.
- 별도 수집 프로세스는 collaboration 도구에 접근하지 않습니다. 따라서 현재 메인과 메인이 생성한 하위 에이전트 중 파일로 전달된 정보만 관찰합니다.
- 모델과 추론 강도는 요청값과 실제 확인값을 분리합니다. 확인되지 않은 실제값은 `미확인`입니다.
- 수집기 heartbeat는 입력 파일 내용과 무관하게 기본 2초마다 갱신됩니다. 실제 상태 관측 시각은 입력의 `observedAt` 또는 `updatedAt`에서만 가져옵니다.
- 에이전트 관측이 180초를 넘으면 원래 상태를 바꾸지 않고 `오래된 정보` 표지만 붙입니다. 정보가 없으면 `미확인`입니다.
- 현재 실행 수와 역할·요청 모델·추론 분포에는 180초 안에 관측된 `running`만 포함합니다. 마지막 상태가 `running`이더라도 오래됐거나 관측시각이 없으면 각각 `오래됨`, `관측 없음` 집계로 분리하며 카드의 원래 상태는 보존합니다.
- 실제 제한 오류는 실패·거부·초과 같은 근거가 있는 한도 이벤트만 포함합니다. 정책 변경과 단순한 상한 부하 준비 배정은 각각 정책 이벤트와 일반 이벤트로 구분합니다.
- 최종 모드의 경과·남은 시간과 freshness 집계는 `finalizedAt`을 기준으로 동결합니다. 브라우저를 오래 열어 둬도 최종 저장본의 실행 수가 시간 경과만으로 바뀌지 않습니다.
- 사용자 하위 에이전트 상한, 설정값, 런타임 고지값의 최솟값을 유효 상한으로 표시합니다. 현재 정책은 사용자 상한 1000개 안에서 준비된 독립 작업을 즉시 배정하는 것입니다. 고정 운영 목표나 단계적 확대 구간은 두지 않습니다.
- P0 전체 검증은 모든 P1 구현을 일괄 차단하는 게이트가 아닙니다. 별도 파일로 독립 구현할 수 있는 준비 완료 작업은 즉시 배정 대상으로 표시합니다.
- 완료 에이전트 수와 열린·닫힌 스레드 수는 별개입니다. `openSubthreads`와 `closedSubthreads`는 런타임에서 실제로 관측해 입력했을 때만 표시하고 에이전트 완료 상태로 추론하지 않습니다.

권장 입력 모양은 다음과 같습니다.

```json
{
  "project": "리틀 룬 가디언즈",
  "phase": "P0 구현",
  "observedAt": "2026-09-19T12:00:00Z",
  "run": {"id": "...", "sessionId": "...", "startedAt": "...", "deadlineAt": "..."},
  "scope": {"description": "현재 메인 및 collaboration 생성 하위"},
  "limits": {
    "userSubagentLimit": 1000,
    "configuredSubagents": 1000,
    "runtimeAdvertisedTotal": 1001,
    "runtimeAdvertisedSubagents": 1000,
    "effectiveSubagentLimit": 1000,
    "runtimeSource": "active collaboration tool metadata",
    "runtimeLimitStatus": "도구 고지; 최대 실측 미확인",
    "policy": "사용자 상한 1000개 내에서 준비된 독립 작업 즉시 배정",
    "expansionBlockers": ["공용 규약 대기", "통합 파일 충돌 위험"]
  },
  "createdSubagents": 2,
  "openSubthreads": null,
  "closedSubthreads": null,
  "agents": [{"id": "main", "kind": "main", "role": "coordinator", "status": "running", "observedAt": "..."}],
  "tasks": [{"id": "M02", "title": "대시보드 확장", "status": "ready", "files": [".agent-monitor/**"], "dependencies": ["M01"], "requestedModel": "gpt-5.6-sol", "requestedReasoning": "high", "verification": ["HTTP"], "integrator": "/root"}],
  "events": [{"id": "evt-1", "occurredAt": "...", "message": "수집기 시작", "kind": "direct"}],
  "blockers": [],
  "links": [{"label": "게임", "url": "http://127.0.0.1:5173/"}]
}
```

## 출력

- `data/state.json`: 단일 수집기가 원자 교체하는 통합 상태
- `data/events.json`: 중복 제거한 이벤트 이력, 화면에는 최근 200건 표시
- `data/final-state.json`: 정상 종료 또는 `--once` 시 최종 스냅샷
- `data/runtime.json`: 현재 서버 PID와 실제 포트

한 번 수집하고 최종 스냅샷만 만들려면 먼저 기존 수집기를 정상 종료한 뒤 `python3 .agent-monitor/collector.py --once`를 실행합니다. 살아 있는 수집기와 동시에 `--once`를 실행하면 단일 작성자 원칙을 어기므로 금지합니다.

종료 뒤 최종 저장본을 화면에서 다시 보려면 다음 읽기 전용 모드를 실행합니다. 이 모드는 입력 보고서와 상태·이벤트 파일을 갱신하지 않습니다. 실제 URL은 평소와 같이 `runtime.json`에도 기록됩니다.

```bash
python3 .agent-monitor/collector.py --view-final
```

화면은 2초마다 데이터를 읽으며 필터 값과 작업·이벤트 스크롤 위치를 유지합니다. 모든 외부 문자열은 DOM의 텍스트 노드로만 넣어 HTML처럼 보이는 로그도 실행되지 않습니다.
