# 작업 계획

최초 시작부터 최대 3시간. 마감 2026-09-19T14:42:37Z (한국시간23:42).
정의된 작업 수 기반 집계이며 난이도·시간 진행률을 뜻하지 않습니다.

| ID | 작업 | 담당 | 선행 | 구현 | 검증 | 통합 |
|---|---|---|---|---|---|---|
| E01 | 환경·실행 조건 | /root | 없음 | complete | complete | complete |
| M01 | 대시보드 MVP | /root/monitor | E01 | complete | complete | complete |
| A01 | 아트·구조 결정 | /root/architecture | E01 | complete | complete | complete |
| A02 | 시각 프로토타입 | /root | M01,A01 | complete | complete | complete |
| G01 | P0 전투·성장 | /root/combat | A02 | complete | unit_passed | pending |
| G02 | P0 UI·사운드·저장 | /root/ui | A02 | complete | type_passed | pending |
| G03 | P0 렌더링·연출 | /root/architecture | A02 | complete | visual_prototype_passed | complete |
| V01 | P0 실제 플레이 | /root | G01,G02,G03 | pending | pending | pending |
| G04 | P1 확장 | 미배정 | V01 | pending | pending | pending |
| G05 | P2 입력·시드 | 미배정 | G04 | pending | pending | pending |
| V02 | 최종 QA·성능 | 미배정 | G05 | pending | pending | pending |
| D01 | 제출물 보존 | /root | V02 | pending | pending | pending |
