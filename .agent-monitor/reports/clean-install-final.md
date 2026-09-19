# 최종 소스 · RC2 깨끗한 설치 재빌드

- 결과: **통과**
- 최종 소스 커밋: `4c3419109ad8dce9649c9fe26d19197731e12105`
- RC2 깨끗한 설치 커밋: `e7bb3acdf8a1059c628e83c0eae392113cb361b7`
- 독립 디렉터리: `/tmp/lrg-clean-1kzRiA`
- 실행 시각: 2026-09-19 12:49:06 UTC
- 원시 증거: `evidence/final-clean-build.txt`

## 검증 방법

RC2에서 `npm ci`에 성공한 독립 설치 디렉터리와 그 `node_modules`를 그대로 재사용했다. RC2와 최종 커밋 사이의 `package.json`, `package-lock.json`을 Git으로 직접 비교했고 차이가 없었다. 보존된 임시 파일도 최종 커밋의 두 파일과 SHA-256이 각각 일치했다.

의존성 설치를 반복하지 않고 최종 커밋의 `src/`, `public/`, `index.html`, `tsconfig.json`만 `git archive`로 임시 디렉터리에 갱신했다. RC2에서 최종 커밋 사이 해당 범위는 수정·추가 파일만 있고 삭제 파일은 없으므로 덮어쓴 뒤 오래된 소스 파일이 남는 경우도 없다.

그 상태에서 아래 명령을 한 번 실행했다.

```text
npm run build
```

## 결과

`tsc --noEmit && vite build`가 종료 코드 0으로 완료됐다. Vite 8.3.0은 32개 모듈을 변환했으며 빌드 시간은 75ms였다. 독립 `dist/`에는 HTML, JavaScript, CSS, favicon, 글꼴 두 개와 글꼴 라이선스까지 7개 파일이 생성됐다.

독립 빌드와 작업공간의 기존 `dist/`를 상대 경로별 SHA-256으로 비교했다. 파일 목록 7개와 각 파일의 해시가 모두 같았다. 핵심 번들은 다음과 같다.

| 파일 | SHA-256 |
|---|---|
| `assets/index-qLwRGcuQ.js` | `2bfd9ff944ec4be07c90251a5c7ecc807d7c535aef3a2c3eec987e5eb1ccda17` |
| `assets/index-ibxWOD-d.css` | `2bcce5c1b855e48e0dc5884881160902173e8e1e09c567dac6fd9b237108f3a6` |
| `index.html` | `7718879f40f128ec4d1f21c08ab6aa19d8943b8cbd79eded0c02e7ec9ca1e67f` |

따라서 **RC2의 깨끗한 의존성 설치 위에서 최종 소스가 추가 설치 없이 재빌드되며, 그 결과가 제출용 기존 `dist/`와 바이트 단위로 일치한다.** 이번 검증에서는 작업공간의 `src/`, `dist/`, `node_modules/`를 수정하지 않았고 브라우저와 전체 테스트를 실행하지 않았다. 임시 빌드는 `/tmp/lrg-clean-1kzRiA`에 보존했다.
