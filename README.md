# EB Navigation Web

EB 프로젝트용 내비게이션 시스템 웹 프로토타입.

## 목적

- 모바일 브라우저에서 실시간 NavMesh + 군중 시뮬레이션 테스트
- Unity 빌드 없이 빠른 이터레이션
- 500+ 에이전트 성능 검증

## 기술 스택

- **언어**: TypeScript
- **렌더링**: Three.js
- **NavMesh**: recast-navigation-js (WASM)
- **빌드**: Vite

## 기능

- 쿼터뷰 3D 뷰포트
- 오브젝트 배치 및 편집 (Cube, Ramp, Cylinder)
- NavMesh 실시간 빌드 및 시각화
- 군중 시뮬레이션 (Crowd)
- 성능 프로파일링
- 반응형 (PC/모바일)

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버
npm run dev

# 빌드
npm run build
```

## 문서

- [기획 문서](./docs/SPEC.md)

## 라이선스

Internal use only (EB Project)
