# V-CLEAN-INSTALL — RC2 독립 설치·프로덕션 빌드

- 결과: **통과**
- 검증 소스: `e7bb3acdf8a1059c628e83c0eae392113cb361b7`
- 실행 시각: 2026-09-19 12:33:27–12:33:29 UTC
- 독립 디렉터리: `/tmp/lrg-clean-1kzRiA`
- 환경: Linux 6.6.87.2-microsoft-standard-WSL2 x86_64, Node.js 24.14.0, npm 11.18.0
- 원시 증거: `evidence/clean-install.txt`

## 방법

동결 커밋에서 `package.json`, `package-lock.json`, `src/`, `public/`, `index.html`, `tsconfig.json`만 `git archive`로 독립 임시 디렉터리에 풀었다. 이 커밋에는 `vite.config.ts`가 없다. 설치 전 추출 파일은 38개였다. 프로젝트 작업공간의 기존 `node_modules/`, `dist/`, `src/`는 npm 작업 디렉터리로 사용하지 않았다.

README의 재현 순서대로 임시 디렉터리에서 아래 두 명령을 각각 한 번만 실행했다.

```text
npm ci
npm run build
```

## 관찰 결과

`npm ci`는 25개 패키지를 설치하고 26개 패키지를 감사했으며 취약점 0건, 종료 코드 0을 반환했다. 별도 계정, registry 변경, 대체 설치 경로 또는 설치 스크립트 승인 명령은 사용하지 않았다.

npm 11.18.0은 `esbuild@0.28.2`의 postinstall이 `allowScripts`에 아직 등록되지 않았다는 안내를 출력했다. 설치 자체는 성공했고, 바로 이어진 TypeScript 검사와 Vite 프로덕션 빌드도 성공했으므로 이 환경에서는 비차단 경고다. 경고를 숨기거나 추가 승인으로 우회하지 않았다.

빌드는 `tsc --noEmit && vite build`를 실행해 30개 모듈을 변환했고 87ms에 완료됐다. 독립 `dist/`에는 `index.html`, favicon, 글꼴 라이선스, 두 로컬 Noto Sans KR 글꼴, CSS와 JavaScript 번들이 생성됐다. 빌드 종료 코드는 0이다.

## 판정과 한계

RC2의 lockfile만으로 깨끗한 의존성 설치와 프로덕션 빌드를 재현했다. 이번 검증은 설치·빌드 재현성만 대상으로 하므로 전체 테스트와 브라우저 플레이는 반복하지 않았다. 임시 산출물은 삭제하지 않았으며 `/tmp/lrg-clean-1kzRiA`에서 확인할 수 있다.
