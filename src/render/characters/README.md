# 캐릭터 페인터 계약

- 담당자는 자기 캐릭터 파일만 수정한다. shared.ts / sprites.ts / renderer.ts / effects.ts는 렌더 통합 담당 소유다.
- export `paintKnight`, `paintMage`, `paintRanger` 중 해당 함수. 인수 `(ctx: CanvasRenderingContext2D, frame: number, pose: CharacterPose)`.
- 논리 캔버스 128×144, 발점 (64,132), 화면 오른쪽을 보는 기본 방향. 렌더러가 좌우 반전, 월드 배치, 전체 bob과 scale을 적용한다.
- frame은 정수 0..3. 각 pose 내부의 진행 단계를 나타내며 화가가 Math.random/시간/전역상태를 읽지 않는다.
- pose: idle, walk, windup, attack, recover, hit, dash. 최소 idle/walk 4프레임 + windup/attack/recover에서 무기와 팔 위치가 구분되어야 한다. hit/dash는 작은 표정/자세 차이로 충분하다.
- 그림 크기/비율/팔레트/얼굴 정체성은 현재 베이스라인을 유지한다. 검·지팡이·활도 캔버스 안으로 들어오게 배치한다. 배경과 그림자는 그리지 않는다.
- `ctx.save()`를 했다면 같은 함수에서 `restore()`한다. Context transform/alpha/composite 상태를 외부에 남기지 않는다.
- shared.ts의 boots(ctx,frame,color) 및 ../art의 도형 함수를 재사용할 수 있다.
- actorSprite(kind,frame,pose)는 프레임과 자세마다 최초 한 번만 Canvas에 그려 캐시한다. 연속 진행값/공격각을 캐시키로 넣지 않는다.
- renderer가 기본 무기 cooldown의 마지막 약 0.12초를 windup, 실제 공격 event 뒤 약 0.14초를 attack, 다음 약 0.16초를 recover로 선택한다. pause/levelup에서는 포즈 시간도 멈춘다.
- 기사: swordswing. 마법사: staffcast. 궁수: draw/release. 해당 파일에서만 고유 포즈를 구현한다.
