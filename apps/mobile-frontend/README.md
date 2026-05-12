# BlueSafe Frontend

XRPL 해커톤 KFIP-2026 BlueSafe 모바일 프론트엔드입니다. 임차인과 임대인이 같은 앱에서 역할을 선택하고, 보증금 락업/계약/정산 흐름을 확인할 수 있도록 구성했습니다.

## Tech Stack

- React 19
- TypeScript
- Vite
- CSS Modules 없이 단일 `App.css` 기반 모바일 UI
- Wanted Sans webfont

## 실행

```bash
npm install
npm run dev
```

기본 개발 주소:

```txt
http://localhost:5179
```

빌드/검증:

```bash
npm run build
npm run lint
```

## 환경 변수

`.env.example`을 참고해 `.env`를 만들면 백엔드와 연결할 수 있습니다.

```txt
VITE_BE1_URL=http://localhost:3000
VITE_BE2_URL=http://localhost:3100
VITE_BLUESAFE_AUTH_TOKEN=
VITE_WALLET_API_URL=http://localhost:3000
```

- `VITE_BE1_URL`: `KFIP-2026/Bluesafe-BE1` NestJS 백엔드
- `VITE_BE2_URL`: `KFIP-2026/bluesafe-backend2` Express 백엔드
- `VITE_BLUESAFE_AUTH_TOKEN`: BE2 role/auth 테스트용 Bearer token

백엔드 URL이 없거나 서버가 꺼져 있으면 일부 기능은 프론트 로컬 fallback 상태로 동작합니다.

## 구현된 화면

### 공통

- 첫 진입 화면
- 역할 선택 화면
  - 임차인
  - 임대인
- Toss-like 모바일 프레임
- 하단 탭 네비게이션
- 화면 전환 애니메이션

### 임차인

- 온보딩
- Toss 인증 안내 모달
- 외국인 등록증 파일 선택 플로우
- 집주인 초대 링크 UI
- 3자 계약서 확인
- 계약서 증빙 저장 흐름
- XRPL 안전 송금 화면
- 온체인 영수증 모달
- 홈 대시보드
- 자동 반환 카운트다운
- 안전 리포트
- 평판 단계 화면
- 공과금 비교 화면
- 퇴실 체크리스트
- 보증금 반환/본국 송금/활동 내역 화면

### 임대인

- 초대 진입 화면
- 임대인 인증 안내 모달
- 매물 정보 화면
- 계약서 확인/동의 흐름
- 계약 체결 완료 화면
- 임대인 홈 대시보드
- 매물 상세
- 미납 월세 자동 차감 화면
- 임차인 이의 수신 화면
- 수익 리포트
- 보증금 정산 승인 화면
- 거래 내역 화면

## 백엔드 연동

API 클라이언트는 `src/api/bluesafe.ts`에 정리되어 있습니다.

### BE1 연동

`KFIP-2026/Bluesafe-BE1`

- `POST /contracts`
  - XRPL 계약/에스크로 생성
- `GET /contracts/:id`
  - XRPL 계약 조회
- `GET /contracts/:id/balance`
  - 계약 계정 잔액 조회

### BE2 연동

`KFIP-2026/bluesafe-backend2`

- `POST /v1/contracts`
  - 운영 계약 draft 생성
- `PATCH /v1/contracts/:contractId/status`
  - 계약 상태 업데이트
- `PATCH /v1/contracts/:contractId/escrow-anchor`
  - XRPL escrow tx hash 연결
- `POST /v1/evidences`
  - 계약서/공과금/사진/영수증 증빙 업로드
- `POST /v1/disputes`
  - 증빙 기반 분쟁 접수
- `POST /v1/disputes/:disputeId/decision`
  - 분쟁 판정 기록
- `GET /v1/settlements`
  - 정산 목록 조회
- `PATCH /v1/settlements/:settlementId/status`
  - 정산 상태 업데이트
- `POST /v1/xrpl/track`
  - XRPL transaction tracking 등록

## 현재 데이터 처리 방식

- 계약 날짜가 있으면 `startsAt`, `endsAt` 기준으로 거주일/남은 일/진행률을 계산합니다.
- 백엔드 데이터가 없으면 오늘 날짜 기준 demo lease를 생성해 UI가 깨지지 않게 표시합니다.
- 자동 반환 화면은 계약 만료일 + 7일을 예상 반환일로 계산합니다.
- 평판 단계는 점수 기반으로 자동 계산합니다.

평판 단계:

| 단계 | 점수 |
| --- | --- |
| 바다 Ocean | 99-100 |
| 샘 Spring | 80-98 |
| 시내 Stream | 60-79 |
| 한 방울 Drop | 37-59 |
| 이슬 Dewdrop | 20-36 |
| 마르는 중 Drying | 5-19 |
| 갈라짐 Cracked | 0-4 |

## 아직 남은 연동

- Toss 실제 인증/OIDC 발급 API
- 초대 링크 생성 API
- 계약 PDF 생성/전자서명 API
- 본국 송금 API
- BE1 계약 ID와 BE2 계약 ID의 서버 단 통합 매핑
- 실제 운영용 role token 관리

## 주요 파일

```txt
src/App.tsx             화면, 상태, 주요 액션
src/App.css             모바일 UI 스타일
src/api/bluesafe.ts     BE1/BE2 API 클라이언트
src/assets/             이미지 에셋
public/claude-design/   Claude 디자인 레퍼런스
```
