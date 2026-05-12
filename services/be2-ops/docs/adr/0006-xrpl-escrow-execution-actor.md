# ADR 0006 — XRPL Escrow 집행 주체 (Finish / Cancel)와 BlueSafe

## Status

Proposed — 제품·법무·Blockchain Lead와 확정 필요.

## Context

- [EscrowFinish](https://js.xrpl.org/interfaces/EscrowFinish.html) / [EscrowCancel](https://js.xrpl.org/interfaces/EscrowCancel.html)의 **`Account`** 필드는 **이 트랜잭션을 네트워크에 제출한 계정**(서명자)이다.
- **`Owner`**는 에스크로에 묶인 XRP의 원 소유자(EscrowCreate의 `Account`)이다.
- **`Delegate`**(PermissionDelegation amendment) 등이 활성화된 네트워크에서는 제3자 제출이 가능해질 수 있다 — Backend2는 현재 **Delegate 미모델링**(ADR 범위 밖이면 `tx_json`만 저장).

BlueSafe는 v6부터 선택적으로 `submitAndWait` 집행 경로를 갖는다. 다음이 불명확하면 운영 사고·규제 질문에 답하기 어렵다.

1. **누가** `EscrowFinish` / `EscrowCancel`에 서명하는가? (운영 핫월렛, Verifier 다중서명, 외부 지갑)
2. **`escrow_submitter_account`**가 `Owner`와 다를 때(미래 Delegate) 비즈니스 규칙은?

## Decision (권장 방향)

1. **MVP / v7**: 집행이 Backend2 시드 지갑에서 나가면 **`escrow_submitter_account` === rippled `Account`**이며, BlueSafe **집행 주체**는 `BLUESAFE_EXECUTION_*` 환경으로 구성된 단일 서명 계정으로 문서화한다.
2. **Verifier / 운영 다중서명**을 켤 경우: [SignerListSet](https://js.xrpl.org/interfaces/SignerListSet.html)으로 **별 XRPL 계정**을 두고, 그 계정을 `escrow_submitter_account`의 유일 허용 값으로 제한하는 **허용 목록(allowlist)** 을 v2 env 표에 추가한다.
3. **외부 지갑만** 서명하는 모드에서는 Backend2는 **제출하지 않고** 해시만 트랙한다; `escrow_submitter_account`는 `tx` 스트림/조회로 채워진 값을 신뢰한다.

## Consequences

- `contracts.landlord_id` / `tenant_id`와 `escrow_owner`의 1:1 대응은 **비즈니스 규칙**이지 프로토콜 강제가 아니다 — 매핑 표(v2 §3.2.1)는 “참조”이며, 계약 메타(별 컬럼·JSON)로 고정할지 별 ADR.
- Delegate 지원 시 `0005` 컬럼 설명에 `Delegate` 필드 보강 및 분류기(허용 Delegate 목록) 추가.

## Links

- [XRPL 기반 서비스 설계 가이드](https://catalyze-research.notion.site/XRPL-2bc898c680bf8044b0b5f9cac6c52b7f?pvs=74) — 내부/외부 지갑, Web2+Web3 경계
- `docs/adr/0005-v7-escrow-xrpl-tx-mapping.md`
