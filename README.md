# BlueSafe Platform

BlueSafe is an XRPL-based rental deposit and utility settlement platform for foreign tenants and landlords in Korea.

The service moves rental trust workflows into transparent on-chain execution: tenant and landlord wallets are connected, rental deposits are locked through XRPL escrow, rent and settlement transactions are recorded, and verified rental history can be issued as a reputation SBT.

## Project Summary

BlueSafe protects foreign tenants in Korea from rental deposit non-return, opaque utility billing, and limited access to local dispute remedies. The platform combines a mobile-first rental workflow with XRPL infrastructure for escrow, fast settlement, low transaction fees, payment metadata, and reputation records.

The initial product targets foreign tenants, co-living operators, real estate agencies, and landlords in high-density foreign residential areas. It can expand into a B2B SaaS product for rental operators that need deposit escrow, automated settlement, transparent rental records, and post-settlement cross-border remittance.

## Project Description

Many foreign tenants in Korea face structural risks during rental contracts: delayed deposit returns, unclear utility charges, language barriers, and weak practical access to legal remedies after leaving the country. BlueSafe addresses these problems by turning private rental promises into transparent, automated, and verifiable workflows.

BlueSafe locks rental deposits using XRPL escrow and a 2-of-3 trust model involving the tenant, landlord, and BlueSafe. This prevents any single party from unilaterally misusing the deposit while still allowing fair release when contract conditions are met. When the lease ends, the product supports automatic return flows based on predefined contract conditions.

The platform also improves utility and rent settlement transparency by connecting operational records to XRPL transactions. Rental actions such as deposit lockup, rent payment, escrow finish, remittance, and reputation issuance are surfaced in the mobile frontend so users can understand both the financial state and the on-chain evidence.

XRPL was selected because it provides native escrow primitives, native multisignature support, low fees, fast finality, and mature infrastructure for compliant financial applications. These properties make XRPL well-suited for recurring rental workflows, small settlement payments, and cross-border financial use cases.

## Demo

- Prototype: [mobile-frontend-liart.vercel.app](https://mobile-frontend-liart.vercel.app/)
- Demo mode: [tenant demo flow](https://mobile-frontend-liart.vercel.app/?demo=1&tx=mock&lang=ko&role=tenant&demoSession=ctr_demo_8KQ91DLM2)
- Demo video: [YouTube Shorts](https://www.youtube.com/shorts/KIQSk51GBj0)
- Repository: [KFIP-2026/bluesafe-platform](https://github.com/KFIP-2026/bluesafe-platform)

## Flow Preview

### 1. Start to Contract

![Start to contract](docs/flow-captures/flow-01-start-contract.png)

### 2. Deposit Lockup and Tenant Home

![Deposit lockup and tenant home](docs/flow-captures/flow-02-deposit-living.png)

### 3. Actions and Landlord Sync

![Actions and landlord sync](docs/flow-captures/flow-03-actions-landlord.png)

## Core Features

- Tenant and landlord role-based mobile flow
- Internal XRPL wallet connection for demo users
- Rental contract draft and signing flow
- XRPL escrow deposit lockup
- On-chain receipt and explorer link surface
- Tenant home dashboard with deposit status, contract period, and activity state
- Rent payment between tenant and landlord wallets
- Automatic deposit return flow
- Reputation SBT issuance flow
- Post-settlement remittance flow with recipient XRPL address and amount input
- Landlord dashboard with contract state, settlement state, and XRPL status
- BE1/BE2 synchronized demo session state for filming and presentations

## XRPL Usage

BlueSafe uses XRPL for:

- Escrow-style deposit lockup and release flows
- Testnet wallet creation and account-to-account payments
- Rent payment transaction submission
- Escrow finish / automatic return demo action
- Reputation SBT / NFT-style transaction surface
- Remittance transaction surface
- Explorer links for transaction verification

Testnet accounts used in the demo:

| Role | XRPL Testnet Address | Explorer |
| --- | --- | --- |
| Tenant | `rEXbaMe5As96SQA5pvLhhrKxFPcBvoHnVR` | [View account](https://testnet.xrpl.org/accounts/rEXbaMe5As96SQA5pvLhhrKxFPcBvoHnVR) |
| Landlord | `r3YwvjvUsfJJakY648SeudzrEdRpGEd1Ex` | [View account](https://testnet.xrpl.org/accounts/r3YwvjvUsfJJakY648SeudzrEdRpGEd1Ex) |

## Monorepo Structure

```txt
apps/
  mobile-frontend/     Toss-like mobile frontend for tenant and landlord flows

services/
  be1-xrpl/            NestJS XRPL service: wallet, escrow, contract, demo chain actions
  be2-ops/             Express operations API: contracts, evidence, settlement, XRPL tracking

packages/
  xrpl-core/           Shared XRPL service/core package

docs/
  flow-captures/       UI screenshots and flow boards
```

## Architecture

```mermaid
flowchart LR
  User["Tenant / Landlord"] --> Frontend["Mobile Frontend"]
  Frontend --> BE1["BE1 XRPL Service"]
  Frontend --> BE2["BE2 Operations API"]
  BE1 --> XRPL["XRPL Testnet"]
  BE2 --> Ops["Contracts / Evidence / Settlement State"]
  BE2 --> XRPLTrack["XRPL Tracking"]
  XRPLTrack --> XRPL
```

## Local Run

Install dependencies from the repository root:

```bash
npm install
```

Start BE1 dependencies if full BE1 contract creation is needed:

```bash
cd services/be1-xrpl
docker compose up -d
cd ../..
```

Run each service in a separate terminal:

```bash
# BE1 XRPL + internal wallet API: http://localhost:3000
npm run dev:be1

# BE2 operations API: http://localhost:3100
npm run dev:be2

# Mobile frontend: http://localhost:5179
npm run dev:frontend
```

For wallet-only local UI testing without Postgres/Redis:

```bash
npm run dev:be1:wallet
```

Open:

```txt
http://localhost:5179
```

Useful demo URL:

```txt
http://localhost:5179/?demo=1&tx=mock&lang=ko&role=tenant&demoSession=ctr_demo_8KQ91DLM2
```

## Environment

Root `.env.example` contains the local defaults:

```env
VITE_BE1_URL=http://localhost:3000
VITE_BE2_URL=http://localhost:3100
VITE_WALLET_API_URL=http://localhost:3000
VITE_BLUESAFE_AUTH_TOKEN=

XRPL_NETWORK_URL=wss://s.altnet.rippletest.net:51233
XRPL_EXPLORER_URL=https://testnet.xrpl.org
XRPL_FAUCET_URL=https://faucet.altnet.rippletest.net/accounts
XRPL_OPERATOR_SEED=

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bluesafe_dev
REDIS_HOST=localhost
REDIS_PORT=6379

IPFS_MODE=mock
BLUESAFE_AUTH=0
XRPL_WSS_URL=
```

`XRPL_OPERATOR_SEED` is required for real XRPL escrow creation through BE1 contract APIs. Demo filming can use mock transaction mode with `tx=mock`, while local real transaction tests can run against XRPL Testnet when funded wallets and backend services are available.

## Main API Surface

BE1 XRPL service:

- `POST /api/wallet/connect`
- `POST /api/wallet/disconnect`
- `GET /api/wallet/demo-session/:sessionId`
- `POST /api/wallet/demo-session/:sessionId`
- `POST /api/wallet/demo-chain-action`
- `POST /contracts`
- `GET /contracts/:id`
- `GET /contracts/:id/balance`

BE2 operations API:

- `POST /v1/contracts`
- `PATCH /v1/contracts/:contractId/status`
- `PATCH /v1/contracts/:contractId/escrow-anchor`
- `POST /v1/evidences`
- `GET /v1/settlements`
- `PATCH /v1/settlements/:settlementId/status`
- `POST /v1/xrpl/track`

## Build

```bash
npm run build:frontend
npm run build:be1
npm run build:be2
npm run build:xrpl-core
```

## Current Stage

BlueSafe is currently at MVP development stage. The repository contains an integrated frontend, BE1 XRPL service, BE2 operations API, shared XRPL package, demo state synchronization, and mobile flow assets for the Korea Financial Innovation Program 2026 submission.
