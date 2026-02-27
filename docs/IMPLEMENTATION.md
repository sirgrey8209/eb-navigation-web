# EB Navigation Web - 구현 계획서

**Goal:** EB 프로젝트의 NavMesh + 군중 시뮬레이션을 웹에서 프로토타이핑하고 테스트하는 도구 구현

**Architecture:** Three.js 기반 3D 렌더링, recast-navigation-js(WASM)로 NavMesh 생성, Vite 빌드, 반응형 UI

**Tech Stack:** TypeScript, Three.js, recast-navigation-js, Vite, HTML/CSS

---

## 진행 상황

| Phase | 설명 | 상태 |
|-------|------|------|
| Phase 1 | 기본 구조 | ✅ 완료 |
| Phase 2 | 오브젝트 시스템 | ✅ 완료 |
| Phase 3 | NavMesh | ✅ 완료 |
| Phase 4 | 군중 시뮬레이션 | ✅ 완료 |
| Phase 5 | 최적화 & 완성 | ✅ 완료 |
| Phase 6 | 미구현 기능 | ⏳ 대기 |

---

## 실행 환경

```bash
# PM2로 실행 (포트 3030)
pm2 start ecosystem.config.cjs

# 또는 직접 실행
cd C:\WorkSpace\eb-navigation-web
npm run dev
```

- **개발 서버**: http://localhost:3030
- **프로덕션 빌드**: `npm run build && npm run preview`

---

## Phase 6: 미구현 기능 (스펙 대비)

아래는 SPEC.md에 정의되어 있으나 아직 구현되지 않은 기능 목록입니다.

### 6.1 오브젝트 시스템

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 크기 조절 핸들 통합 | TransformHandles가 ObjectManager에 연결되지 않음 | 중 |
| 오브젝트 이동 | 선택된 오브젝트 드래그 이동 | 중 |
| 그리드 스냅 | Shift + 드래그 시 1m 단위 스냅 | 하 |
| 오브젝트 복제 | Duplicate 버튼/단축키 | 하 |
| 오브젝트 Position/Size 입력 | 숫자 직접 입력 UI | 하 |

### 6.2 카메라 컨트롤

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 카메라 회전 | 우클릭 드래그로 요 회전 | 중 |
| 모바일 핀치 줌 | 두 손가락 핀치 제스처 | 중 |
| 모바일 2손가락 회전 | 두 손가락 회전 제스처 | 하 |

### 6.3 NavMesh 시스템

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| NavMesh 빌드 설정 UI | Cell Size, Agent Radius 등 조절 | 중 |
| 시각화 토글 | NavMesh 표시/숨김 체크박스 | 중 |
| 디버그 시각화 | Voxels, Regions, Contours 표시 옵션 | 하 |
| 경로 시각화 | Agent Paths 라인 렌더링 | 하 |

### 6.4 군중 시뮬레이션

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| Max Agents 슬라이더 | 최대 에이전트 수 조절 (100~1000) | 중 |
| Agent Speed 슬라이더 | 에이전트 속도 조절 (1~10 m/s) | 중 |
| 플레이어 대시 | Shift/버튼으로 대시 | 하 |

### 6.5 성능 프로파일링

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| NavMesh Query 시간 표시 | 경로 탐색 시간 측정 | 중 |
| 메모리 사용량 표시 | JS Heap 크기 | 중 |
| FPS 그래프 (스파크라인) | 최근 60프레임 시각화 | 하 |
| Frame Breakdown 바 | 각 시스템별 비율 표시 | 하 |
| Export CSV | 성능 데이터 내보내기 | 하 |
| 성능 경고 시스템 | FPS < 30 시 경고 표시 | 하 |

### 6.6 UI/UX

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 설정 패널 (Settings) | NavMesh, Simulation, Graphics 설정 모달 | 중 |
| 풀스크린 버튼 | Fullscreen API 연동 | 하 |
| 키보드 단축키 | B(Build), Space(Start/Stop), R(Reset) | 하 |

### 6.7 향후 확장 (SPEC 14장)

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 씬 저장/로드 | JSON으로 오브젝트 배치 저장 | 중 |
| Flow Field 시각화 | 커스텀 Flow Field 구현 | 하 |
| Unity 익스포트 | NavMesh 데이터 익스포트 | 하 |

---

## 구현 우선순위 제안

### 높음 (바로 구현 가능)

1. **NavMesh 시각화 토글** - Show NavMesh 체크박스
2. **Max Agents 슬라이더** - UI 추가 및 연결
3. **Agent Speed 슬라이더** - UI 추가 및 연결
4. **메모리 사용량 표시** - performance.memory API

### 중간 (개선 필요)

5. **크기 조절 핸들 통합** - TransformHandles ↔ ObjectManager 연결
6. **오브젝트 드래그 이동** - ObjectManager에 이동 로직 추가
7. **NavMesh 빌드 설정 UI** - 설정 모달/패널
8. **모바일 핀치 줌** - CameraController 터치 이벤트

### 낮음 (선택적)

9. 키보드 단축키
10. FPS 그래프
11. 씬 저장/로드
12. 성능 경고 시스템

---

## Task 템플릿

### Task N: [기능명]

**Files:**
- Create/Modify: `src/...`

**Step 1: 구현**
```typescript
// 코드
```

**Step 2: UI 연결**
- index.html 또는 main.ts 수정

**Step 3: 테스트**
- 예상 동작 확인

**Step 4: Commit**
```bash
git add [files]
git commit -m "feat: [description]"
```

---

## 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2025-02-27 | 0.1 | 초안 작성 |
| 2025-02-27 | 0.2 | Phase 1 완료, Phase 2-5 계획 추가 |
| 2026-02-27 | 0.3 | Phase 3 완료 (NavMesh) |
| 2026-02-27 | 0.4 | Phase 4 완료 (군중 시뮬레이션) |
| 2026-02-27 | 1.0 | Phase 5 완료 (최적화 & 완성) |
| 2026-02-27 | 1.1 | 미구현 기능 목록 정리 (Phase 6) |
| 2026-02-27 | 1.2 | FPS 패널 상단 이동, 오브젝트 드래그 배치 및 우클릭 취소 추가 |
