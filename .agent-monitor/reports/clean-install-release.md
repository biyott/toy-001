# 릴리스 후보 깨끗한 설치 재빌드

- 설치·빌드 재현성: **통과**
- 릴리스 후보: `c68e8fbca1c21baf75cb728e73c57243d68a5115`
- RC4 비교 기준: `4c3419109ad8dce9649c9fe26d19197731e12105`
- RC2 깨끗한 설치 기준: `e7bb3acdf8a1059c628e83c0eae392113cb361b7`
- 독립 디렉터리: `/tmp/lrg-clean-1kzRiA`
- 실행 시각: 2026-09-19 13:17:04 UTC
- 원시 증거: `evidence/release-clean-build.txt`

## 방법

RC4와 릴리스 후보를 지정된 전체 경로 범위로 비교한 결과 `src/render/renderer.ts`만 달랐고, `package.json`과 `package-lock.json`은 동일했다. 보존된 임시 디렉터리의 두 의존성 파일도 기존 SHA-256을 유지했다. 따라서 `npm ci`를 반복하지 않고 RC2에서 만든 깨끗한 `node_modules`를 그대로 재사용했다.

stale 소스가 남지 않도록 임시 디렉터리의 기존 `src`를 삭제하는 대신 `/tmp/lrg-clean-1kzRiA/src-before-c68e8fb`로 이동해 보존했다. 그 뒤 후보 커밋의 전체 `src` 34개 파일을 새 `src`에 풀었다. 백업은 소스 경로 밖에 있어 빌드 입력에 포함되지 않는다.

이 상태에서 `npm run build`를 한 번만 실행했다. `tsc --noEmit && vite build`는 종료 코드 0으로 완료됐고 Vite 8.3.0이 32개 모듈을 변환했다. 독립 `dist/`의 7개 파일과 현재 작업공간 `dist/`의 같은 상대 경로를 SHA-256으로 비교한 결과 모두 일치했다.

| 파일 | SHA-256 |
|---|---|
| `assets/index-VImh_xM7.js` | `cb4aef1f912a484f8aca8a2d95ffaeb6e75af8c797825ac581367ef8b8af32e8` |
| `assets/index-ibxWOD-d.css` | `2bcce5c1b855e48e0dc5884881160902173e8e1e09c567dac6fd9b237108f3a6` |
| `index.html` | `0cdc6f394d5722e46a1bb5b6e7c24246500568ac0a819130b984ca02e0f03ab3` |

## 성능 결과와 한계

메인의 완료된 별도 주 계측에서 기준은 1280×720 **28.209fps**, 1920×1080 **17.224fps**였고 후보 B는 각각 **28.909fps**, **18.167fps**였다. 두 해상도 모두 소폭 개선됐지만 **60fps 목표에는 미달**한다. 과거 RC4 수치와 증거는 그대로 보존한다.

이번 담당은 브라우저를 다시 실행하지 않았으며 위 성능 수치를 독립 재측정하지 않았다. 또한 게임 플레이와 전체 테스트를 반복하지 않았다. 따라서 이번 통과 판정은 오직 **기존의 깨끗한 의존성 설치에서 후보 소스가 재빌드되고, 그 결과가 현재 제출용 `dist/`와 바이트 단위로 일치한다**는 범위에 한정된다. 작업공간의 `src/`, `dist/`, `node_modules/`와 공용 문서는 수정하지 않았다.
