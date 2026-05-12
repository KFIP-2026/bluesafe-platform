import { Divider, H1, H2, Stack, Table, Text } from 'cursor/canvas';

export default function BlueSafeBackend2Plan() {
  return (
    <Stack gap={20}>
      <H1>BlueSafe Backend2 통합 개발가이드</H1>
      <Text>
        기준 문서: BlueSafe 통합기획안, 개발가이드, XRPLDevSource, Web3 서비스 기획 가이드, XRPL 기반 서비스 설계 가이드
        + 사용자가 태그한 XRPL 공식/샘플 docs 세트 + xrpl_publicapimethods + xrpl_teccodes.
      </Text>

      <Divider />
      <H2>0) 결론: 문서를 하나로 정리했는가?</H2>
      <Text>
        네. 아래 가이드는 문서를 따로 보는 방식이 아니라, Backend2 관점에서 유저플로우-기능-개발순서-공식문서 의존성을 한 번에 연결한 통합
        실행 문서다.
      </Text>

      <Divider />
      <H2>1) 문서 충족도</H2>
      <Table
        headers={['분류', '현재 상태', 'Backend2 관점 결론']}
        rows={[
          [
            '핵심 XRPL 문서',
            'xrpl.js, Escrow(Create/Finish/Cancel), SignerListSet, Flags, Error Codes, HTTP/WSS, public API methods',
            'MVP 구현 충분',
          ],
          [
            '실패 처리 문서',
            'xrpl_teccodes로 tes/tec/tem/ter 분기 근거 확보',
            '재시도와 실패 종결 정책 수립 가능',
          ],
          [
            '확장 기능 문서',
            'XLS-20/33/70/80, NFT, 샘플코드(TypeScript/Python), 내부/외부 지갑 연동 보유',
            '고급 기능 설계 가능',
          ],
          [
            '권장 추가 문서 #1',
            'IPFS pinning provider 정책 문서(보존/복제/재시도)',
            '증빙 유실 리스크 최소화',
          ],
          [
            '권장 추가 문서 #2',
            '알림 채널 문서(FCM/APNs/이메일) + 실패 재전송 정책',
            '중요 이벤트 누락 방지',
          ],
        ]}
      />

      <Divider />
      <H2>2) 유저플로우 기반 단계별 개발가이드</H2>
      <Table
        headers={['단계', 'Backend2 구현 상세', '필수 공식문서', '완료 기준']}
        rows={[
          [
            '1) 계약 등록',
            '계약/증빙 업로드 API, CID 생성/검증, 메타 저장, 버전 추적',
            'xrpl_meta, xrpl_nftoken, xrpl_xls20, xrpl.js',
            'CID 재계산 검증 성공, 계약 1건 조회 가능',
          ],
          [
            '2) Escrow 생성',
            '트랜잭션 제출 후 tx 조회 validated=true 확인, account_tx 백필',
            'xrpl.js, xrpl_escrowcreate, xrpl_http/wss, xrpl_publicapimethods',
            '트랜잭션 상태가 pending에서 validated로 전이',
          ],
          [
            '3) 상태 동기화 + 월 정산',
            'subscribe 실시간 수신 + account_tx 보정, 정산 이벤트 기록/알림',
            'xrpl_publicapimethods(subscribe, account_tx), xrpl_http/wss',
            '누락 이벤트 없이 정산 상태 최신화',
          ],
          [
            '4) 분쟁 접수',
            '증빙 CID 번들 생성, 케이스 생성, 상태머신 시작, 감사로그 기록',
            'xrpl_meta, xrpl_nftoken, xrpl_xls20',
            '분쟁 케이스 1건의 증빙 체인 완성',
          ],
          [
            '5) 판정/집행',
            'Verifier mock 다수결 결과 기반 EscrowFinish/Cancel 실행, tes/tec/tem/ter 분기',
            'xrpl_escrowfinish, xrpl_escrowcancel, xrpl_teccodes, xrpl_errorcodes',
            '성공/재시도/실패종결 정책 자동 적용',
          ],
          [
            '6) 종료/리포트',
            '케이스 종료, 운영 리포트/감사로그/통계 API 제공',
            'xrpl_publicapimethods(tx, account_objects), xrpl_http/wss',
            '운영 콘솔에서 분쟁별 전체 이력 재현 가능',
          ],
        ]}
      />

      <Divider />
      <H2>3) 나의 기능 도출 (Backend2)</H2>
      <Table
        headers={['우선순위', '모듈', '핵심 구현', '의존 문서']}
        rows={[
          [
            'P0',
            'XRPL State Watcher',
            'subscribe + tx + account_tx + account_objects 기반 상태 동기화',
            'xrpl_publicapimethods, xrpl_http/wss, xrpl.js',
          ],
          [
            'P0',
            'Tx Outcome Classifier',
            'tes/tec/tem/ter 분류 + 재시도/실패종결 정책',
            'xrpl_teccodes, xrpl_errorcodes',
          ],
          [
            'P0',
            'Evidence Vault (IPFS)',
            '계약/분쟁 증빙 업로드, CID 생성, 무결성 검증, 버전 추적',
            'xrpl_meta, xrpl_nftoken, xrpl_xls20',
          ],
          [
            'P0',
            'Dispute Case Engine',
            '분쟁 상태머신(접수/검토/판정/집행요청/종료)',
            'xrpl_escrowfinish, xrpl_escrowcancel, xrpl_signerlistset',
          ],
          [
            'P0',
            'Notification Hub',
            '정산/분쟁/만료/반환 이벤트 발송 + 재전송',
            'xrpl_publicapimethods(이벤트 소스)',
          ],
          [
            'P1',
            'Operator Console API',
            '계약/정산/분쟁/Verifier 관리 및 필터 조회',
            'xrpl_publicapimethods, xrpl_http/wss',
          ],
          [
            'P1',
            'Audit Trail',
            '판정/상태변경/알림발송 이력 불변 로그',
            'xrpl_errorcodes, xrpl_teccodes',
          ],
          [
            'P2',
            'Reputation Event Bridge',
            '판정 결과를 SBT 업데이트 이벤트로 전달',
            'xrpl_xls20, xrpl_xls70, xrpl_xls80',
          ],
        ]}
      />

      <Divider />
      <H2>4) 구현 순서 가이드 (8주)</H2>
      <Table
        headers={['주차', '목표', '핵심 작업', '산출물']}
        rows={[
          [
            'W1',
            '설계 고정',
            '도메인 모델/상태머신/이벤트 스키마 확정 + docs/adr 결정 기록',
            'ADR + API 초안',
          ],
          [
            'W2',
            'Evidence Vault',
            'IPFS 업로드/검증 + MIME·용량 + 선택 AES-GCM + retention 메타',
            'IPFS 모듈 + 테스트',
          ],
          [
            'W3',
            'Dispute 엔진',
            '케이스·상태 전환·PATCH review·verifier-votes·review-state·Verifier mock',
            'Dispute API v1',
          ],
          [
            'W4',
            'XRPL 연동 안정화',
            'tx/account_tx/account_objects + subscribe(ledger+옵션 transactions) + account 백필 + live probe + health',
            'XRPL sync worker + watcher + xrpl-live-probe',
          ],
          [
            'W5',
            '에러 분류/재시도',
            'tec/tem/ter 정책 + delayed_jobs + clientPolicyHint + health 메트릭 + 정책 소진 이벤트',
            'Tx outcome policy module',
          ],
          [
            'W6',
            '알림 + 운영사 콘솔 API',
            '알림 발송/재시도 + 검색/필터/감사로그',
            'Notification module + Console BE v1',
          ],
          [
            'W7',
            '통합 검증',
            '계약→분쟁→판정→집행요청 E2E 테스트',
            '통합 테스트 리포트',
          ],
          [
            'W8',
            '데모 고도화',
            '장애 시나리오(네트워크 지연, 중복 이벤트) 점검',
            '데모 스크립트 + 운영 런북',
          ],
        ]}
      />

      <Divider />
      <H2>5) 공식문서 패키지 (단계별 빠른 참조)</H2>
      <Table
        headers={['패키지', '포함 문서', '사용 단계']}
        rows={[
          [
            'A. 트랜잭션/상태',
            'xrpl.js, xrpl_http/wss, xrpl_publicapimethods, xrpl_escrowcreate, xrpl_escrowfinish, xrpl_escrowcancel',
            '2, 3, 5, 6',
          ],
          [
            'B. 실패 처리',
            'xrpl_teccodes, xrpl_errorcodes, xrpl_flags',
            '2, 5, 6',
          ],
          [
            'C. 증빙/메타',
            'xrpl_meta, xrpl_nftoken, xrpl_xls20',
            '1, 4',
          ],
          [
            'D. 신원/권한 확장',
            'xrpl_xls70, xrpl_xls80, xrpl_signerlistset',
            '5, 7+',
          ],
          [
            'E. 레퍼런스/샘플',
            'xrpl핵심기능별샘플코드typescript, xrpl핵심기능별샘플코드python, XRPL Korea Financial Innovation Program Sample Code',
            '전 단계 구현 보조',
          ],
        ]}
      />
    </Stack>
  );
}
