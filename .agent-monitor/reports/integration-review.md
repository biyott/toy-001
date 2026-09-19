# V02 — P1/P2 연결 코드 독립 리뷰

- 역할: reviewer / 입력·전투 통합. 요청 모델 Astra xhigh, 실제 런타임 설정은 독립 미확인.
- 검토 시작: 2026-09-19 12:22 UTC. 전체 마감 14:42:37 UTC.
- 범위: `src/main.ts`, `src/game/engine.ts`, P1 context/weapons/enemies/boss, gamepad/touch와 연결 UI 읽기. 필요한 대상 단위 검사만 실행했다.
- 변경 파일: 이 보고서만. 게임 소스·공용 문서·테스트 수정, 전체 빌드, 브라우저 조작, 추가 에이전트 생성 없음.
- **결론: 구체적인 게임패드 뒤로가기 결함 1개를 재현·전달했고 메인 수정 후 제한 재현이 통과했다. 현재 읽은 범위에서 추가로 확정한 미해결 연결 결함은 없다. 최종 출시 통과 판정은 아니다.**

## 검증 버전

작업 디렉터리는 HEAD `e131d358032ef0c8bcde4e63b187cf15c99e1295` 위의 미커밋 P1/P2 변경 상태였다. 다른 담당자가 작업 중이므로 HEAD만으로 이 리뷰 소스를 식별할 수 없고, 최종 릴리스 고정 상태로 취급하지 않는다.

| 파일 | 검토 SHA-256 |
|---|---|
| main.ts, 결함 재현 전 | `3a21179bcbdf7d86f586da2fb3efa6a3f89fb631433b1ac2646f2c6ec46837bd` |
| main.ts, 메인 수정 후 | `6309b19b066b9958cca098da0670d7d43dff1b2c2ac99f2c13f2979a937db083` |
| engine.ts | `2310a934e0033ff72c35740422ea9898e73ddc41aaf3bb186e9284c9fbfcf7ce` |
| p1-context.ts | `96f266e4e669efabd53e67308c63ebecf4426d0d4ca9e25d6bafbc5f51ccc9a8` |
| p1-weapons.ts | `ee568a960ab24e377911583db105c4986be37b5b07ac36e50b6f07ff7828dc89` |
| p1-enemies.ts | `6385a0d6e260cfc6d67714a7f826499c7d67ae9384f110a1cca80293bc9c2936` |
| p1-boss.ts | `a02e8ab24763f7484ef5838977c0d96b483f290ee32064a152d26ccffcc1aeb8` |
| controls/gamepad.ts | `d4a1c3248beba1a86c7a50e7afefd2bf889d3f4f6cca7c1a7f0a5dab09cc1e86` |
| controls/touch.ts | `7227a734e9339464cce5d7b4dbf8c15720c42e6acec76f999c299525f0031f90` |

## IR-01 / P2 — 게임패드 B가 숨겨진 도감 닫기를 실행

**위치:** 최초 `src/main.ts:55–57`, 연관 `src/ui/ui.ts:335–340`.

**재현:** 게임을 시작하고 일시정지한 뒤, 도감이 열려 있지 않은 상태에서 게임패드 B(back)를 누른다. 또는 레벨업·결과 화면에서 B를 누른다.

**기대:** 일시정지에서는 resume 명령을 한 번 실행한다. 실제 도감이 열려 있으면 도감만 닫는다. 성장/결과 화면에서는 숨겨진 도감의 콜백을 실행하지 않는다.

**실제 원인:** 도감 닫기 버튼은 초기 UI 생성 때부터 DOM에 항상 존재한다. 최초 `document.querySelector('[data-testid="codex-close"], ...')`는 숨김 여부를 확인하지 않아 모든 메뉴 상태에서 이 버튼을 반환했다. 따라서 paused에서 B는 resume 분기로 가지 않았다. `closeCodex()`는 title을 표시하고 숨은 도감 열기 버튼에 초점을 옮기므로, 다른 모달 상태에서도 불필요한 화면·초점 변경을 만들 수 있었다.

**독립 재현:** 실제 main.ts의 menuInput 함수 본문을 읽어 TypeScript 타입만 제거하고, DOM 조회/버튼을 제한된 스텁으로 제공했다. paused/levelup/victory/title 네 경우 모두 `hiddenCloseClicks=1`, `commands=[]`였다. 실제 브라우저·물리 게임패드로 재현했다는 뜻은 아니다.

**수정 상태:** 메인이 `querySelectorAll(...).find(button => button.getClientRects().length > 0)`로 실제 보이는 닫기만 찾도록 수정했다. 수정 소스를 다시 읽었고 같은 제한 재현을 실행했다.

| 수정 후 조건 | 관측 | 판정 |
|---|---|---|
| paused + 숨김 close | close 0회, resume 1회 | 통과 |
| levelup + 숨김 close | close 0회, 명령 없음 | 통과 |
| victory + 숨김 close | close 0회, 명령 없음 | 통과 |
| title + 보이는 close | close 1회, 명령 없음 | 통과 |

**현재 상태:** 소스·제한 재현 수준에서 수정 수용. 메인이 준비 중인 브라우저 게임패드 스냅샷의 pause+B 복귀 및 도감+B 닫기 검증은 아직 이 리뷰에서 확인하지 않았다.

## 실행한 대상 검사

```text
./node_modules/.bin/tsx --test tests/p1-content.test.ts tests/p1-boss.test.ts tests/movement.test.ts tests/gamepad.test.ts
35 tests / 9 suites / 35 passed / 0 failed / 84.45ms
```

- P1 콘텐츠9개: 6무기·16업그레이드·3캐릭터 계약, tier0 보존, 실제 P1 무기획득·방어피해, 정상480/540초·시연120/150초 보스 일정, 두 종류 처치와 제한시간의 결합 조건.
- 골렘9개: 고리/균열의 고정 예고·발동·1회 피해·회복, 고리 안전영역, 균열 회피, 선 끝 모서리의 실제 원 접촉, 개체별 독립 순환과 엔진 연결.
- 이동7개: 기존 모서리 실패와 겹친 두 소품의 경계 해소가 통과했다. 이 결과는 이전 리뷰의 movement 5/6 상태 이후 수정 근거다.
- 게임패드10개: deadzone, d-pad, 누름 edge, 메뉴 hysteresis, 중립 복귀, 연결 끊김·점유, 입력 병합. 이 모듈 검사만으로 main 메뉴 연결 결함이 없다고 판단하지 않았으며 IR-01은 별도로 재현했다.

추가로 파일을 만들지 않는 짧은 Node unit fixture에서 실제 엔진의 frost→slow 연결을 확인했다. 단일 고블린과 빈 장애물 맵, 서리1레벨을 구성하여 실제 step으로 공격·둔화를 실행했다. 다음 0.01초 이동량은 `0.39270000000000493`으로 기본 `0.66 × 0.595`와 일치했다. pause 동안 elapsed는 불변이고, 둔화 만료 후 이동량은 `0.6599999999999966`으로 복구됐다. restart 뒤 기본 검과 bossDefeated=false도 확인했다. 이 fixture는 정상 플레이 증거가 아니다.

## 연결 경계 읽기 결과

- P1Context의 state는 getter여서 restart로 바뀐 GameState를 계속 참조한다. 전투 RNG도 현재 closure의 rng를 읽으며 새 판 reset 뒤 과거 스트림을 붙잡지 않는다.
- 공통 타이머는 엔진이 한 번 갱신하고, 골렘/추가 일반 적 hook이 true를 반환하면 기존 AI로 중복 진입하지 않는다. 접촉 피해도 hook 뒤 공통 경로 한 번이다.
- 무기 hook은 인식한 P1 무기에 대해 대기 중에도 true를 반환하여 기존 무기 처리와 중복되지 않는다. 화염구 직격 후 폭발은 최초 피해 대상을 hitIds에서 제외하고 projectile을 소비한다.
- slow는 게임 elapsed를 사용하고 reset·사망 시 제거된다. 현재 서리의 단계별 factor/기간과 경계는 정상 만료된다. 일시정지 시간을 둔화 경과로 세지 않는다.
- P1 승리는 mushroomKing/golem 종류별 처치 Set과 제한시간을 모두 요구한다. 두 번째 보스를 위한 자리 확보는 일반 적만 제거하여 살아 있는 첫 필수 보스를 지우지 않는다.
- line은 가장 가까운 직사각형 점과 몸 원 거리로 판정하고, 렌더러의 생략 기본값도 length=radius, width=24, cone width=1.6으로 일치한다. 새 골렘 균열은 길이·폭을 명시한다.
- challenge 시작은 검증한 uint32 시드를 options에 전달하며 main은 challenge 결과를 일반 최고 기록·승수 저장에서 제외한다. 이 저장 분기는 코드로 확인했으며 이번 리뷰에서 UI부터 결과까지 challenge 판을 실행하지 않았다.
- touch는 playing일 때만 활성화되고 phase 변경·명령·blur에서 해제한다. 실제 기기의 포인터 취소·작은 화면 배치·키보드와 동시 조작 체감은 브라우저 검증 범위로 남긴다.

읽기 검토의 “추가 결함 없음”은 모든 입력 조합이나 기기에서 결함이 없음을 증명하지 않는다. 현재 구현 계약과 수행한 제한 검증에서 보고할 구체적인 추가 오류를 찾지 못했다는 뜻이다.

## P0 정상 완주 증거 업데이트

`evidence/p0-normal-retry-result.json`을 읽었다. 동결4174/1.0.0-p0, 12:03:01~12:13:03 UTC, 벽시계602.698초, 게임600.0166666664496초, **victory**, HP최저93, 피해27,1122처치, 보스1처치, 두 시너지, 오류 목록 없음이다. 기록의 method는 실제 UI/키보드 입력과 읽기 전용 관찰, 가속·무적·게임 상태 변경 없음을 명시한다.

**동결 P0 정상10분 승리 근거를 수용한다.** P1 두 보스·신규 무기·입력 통합 이후 버전의 정상 완주 증거로 전용하지 않는다. P1 실제 화면·플레이·최종 빌드 검증과 출시 판단은 아직 남아 있다.
