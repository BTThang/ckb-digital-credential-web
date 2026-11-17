# CKB Credential Verification Infrastructure

**Public, chain-derived digital credential verification built on Nervos CKB.**

[Live Application](https://ckb-digital-credential-web.vercel.app/) · [Public Verification](https://ckb-digital-credential-web.vercel.app/verify) · [Frontend Repository](https://github.com/BTThang/ckb-digital-credential-web) · [Backend Repository](https://github.com/BTThang/ckb-digital-credential-service) · [Week 12 Report](https://github.com/BTThang/ckbuilder/blob/main/week12/ckb_weekly_report_w12.md)

![Network](https://img.shields.io/badge/Network-CKB%20Testnet-blue)
![Version](https://img.shields.io/badge/Version-1.0.0-green)
![Week 12](https://img.shields.io/badge/Week%2012-PASS-brightgreen)

---

## Overview

CKB Credential Verification Infrastructure is an on-chain digital credential system built on [Nervos CKB](https://www.nervos.org/).

The project explores how digital credentials can be represented by real blockchain objects and independently verified against live on-chain state.

Instead of treating an application database as the authority for credential ownership or validity, the system uses CKB's cell model as its source of truth. A read-only backend index supports discovery and application performance, while verification decisions are derived from the relevant on-chain data.

The infrastructure consists of two independently deployed components:

- **Frontend:** A web dApp for wallet connection and the Spore credential lifecycle, including issuance, browsing, transfer, melt and public verification.
- **Backend:** A read-only indexing and verification service with a shared verification core supporting multiple credential families.

### Supported Credential Families

The backend verification service currently supports:

| Credential family | On-chain object | Verification basis |
|---|---|---|
| Spore | Spore cell | Live cell state and committed creation transaction, with optional issuer proof |
| Vellum Claim | `did:ckb` DID Metadata Cell | Live on-chain DID metadata |
| CKB-PoP | `dob-badge` cell | Live cell matching the configured code hash |

**Scope clarification:** The frontend currently provides the Spore credential lifecycle. Support for all three families is implemented in the backend verification service; this does not mean the frontend provides issuance and management flows for all three.

The project is deployed on CKB Testnet with a public web application and HTTP API.

## Live Demo

| Resource | Link |
|---|---|
| Web application | [Open dApp](https://ckb-digital-credential-web.vercel.app/) |
| Public verification | [Verify a Spore credential](https://ckb-digital-credential-web.vercel.app/verify) |
| Backend API | [API base URL](https://ckb-digital-credential-service.onrender.com/api) |
| Frontend source | [GitHub repository](https://github.com/BTThang/ckb-digital-credential-web) |
| Backend source | [GitHub repository](https://github.com/BTThang/ckb-digital-credential-service) |
| Development reports | [CKB Builder repository](https://github.com/BTThang/ckbuilder) |
| Final project report | [Week 12 — Production Evidence & Handover](https://github.com/BTThang/ckbuilder/blob/main/week12/ckb_weekly_report_w12.md) |

Public verification does not require an account or wallet connection.

## Key Features

### 1. Spore Credential Lifecycle

The frontend supports the following operations:

- Issue a Spore credential through a wallet-signed transaction.
- Browse and filter indexed credentials.
- View credential details.
- Transfer a credential to another owner.
- Melt a credential.
- Track wallet transactions and reconcile their status with on-chain state.

A transfer moves the existing Spore cell to a new owner while preserving its credential ID. Melting destroys the cell, after which the credential can no longer be found on-chain.

### 2. Multi-family Verification

The backend uses a shared verification core with family-specific verifiers:

- Spore credentials.
- Vellum Claim (`did:ckb`) credentials.
- CKB-PoP (`dob-badge`) credentials.

Each verifier checks the relevant on-chain object and returns a consistent verification result.

### 3. Public Verification

The public verification experience allows anyone to check a Spore credential without creating an account or connecting a wallet.

It supports:

- Checking whether a credential exists on-chain.
- Reading the current owner from the live cell's lock script.
- Comparing the actual owner with an optional expected owner.
- Distinguishing credential validity from ownership comparison.
- Sharing verification results through URLs.
- Inspecting issuer proof when source-backed proof is available.

An ownership mismatch does not automatically mean the credential itself is invalid.

### 4. Wallet Integration

- Connect through CKB-compatible wallets, including JoyID.
- Use wallet-based identity rather than application passwords.
- Sign credential write transactions in the browser.
- Keep private keys and transaction signing outside the backend.

### 5. Backend Indexing and Transaction Tracking

The backend provides:

- Read-only credential indexing.
- Transaction tracking and reconciliation.
- Public credential verification endpoints.
- Credential-family discovery.
- Chain health information.
- Public version and build metadata.

The index is used for discovery and application performance. It is not the authority for credential ownership or validity.

## How It Works

The system follows a chain-authoritative verification model.

```text
                 User / External Application
                            |
                            v
                  Frontend / Public API
                            |
                            v
                  Backend Verification API
                            |
                            v
                  Shared Verification Core
                            |
               +------------+------------+
               |            |            |
               v            v            v
             Spore       Vellum        CKB-PoP
            Verifier     Verifier      Verifier
               |            |            |
               +------------+------------+
                            |
                            v
                       CKB Testnet
                            |
                            v
                   Live On-chain State
                            |
                            v
                   Verification Result
```

The verification flow:

1. A user or external application submits a credential identifier and, where required, a credential-family hint.
2. The backend routes the request to the appropriate family-specific verifier.
3. The verifier checks the relevant on-chain object and its state.
4. Ownership is derived from the live cell's lock script where applicable.
5. The shared verification core produces a consistent result.
6. The result is returned to the public interface or API consumer.

The backend index can assist with lookup and discovery, but the blockchain remains authoritative.

### Verification Result Semantics

The API uses a common verdict vocabulary:

| Result | Meaning |
|---|---|
| `valid` | The credential passes the applicable verification checks |
| `invalid` | The credential fails an applicable verification check |
| `not_found` | The required on-chain credential object cannot be found |
| `unable_to_verify` | A reliable result cannot be established, for example because of infrastructure or chain-access failure |
| `unsupported` | The requested credential family is not supported or available for verification |

An infrastructure failure must never be interpreted as proof that a credential is valid.

Ownership comparison is a separate result from credential validity. A credential may be valid while being held by a different address than the expected owner.

## Architecture

The project is maintained in two separate repositories.

| Component | Technology | Responsibility |
|---|---|---|
| Frontend | React 19, TypeScript, Vite | User interface, wallet connection, Spore operations and public verification |
| Backend | Express 5, TypeScript, SQLite | Read-only indexing, transaction tracking and verification API |
| Blockchain | Nervos CKB Testnet | On-chain credential objects and ownership state |
| Wallet | CCC / JoyID | Wallet connection and transaction signing |
| Frontend hosting | Vercel | Production web application |
| Backend hosting | Render | Production API service |

### Frontend — `ckb-digital-credential-web`

[View Frontend Repository](https://github.com/BTThang/ckb-digital-credential-web)

Responsible for:

- Wallet connection and authentication.
- Spore credential issuance.
- Credential browsing and management.
- Transfer and melt operations.
- Public verification interface.
- Transaction history and status tracking.

### Backend — `ckb-digital-credential-service`

[View Backend Repository](https://github.com/BTThang/ckb-digital-credential-service)

Responsible for:

- Credential indexing.
- Chain-derived verification.
- Multi-family verification.
- Transaction tracking and reconciliation.
- Public API and service health.
- Build metadata and version traceability.

## Security and Trust Model

The system is designed around the following principles.

### On-chain State Is Authoritative

The live CKB cell is the source of truth for credential existence and ownership.

The backend database is an index, not an independent authority.

### Wallet-Signed Transactions

Credential write transactions are signed through the user's own wallet.

The backend does not hold user private keys or sign transactions on behalf of users.

### Live Ownership Verification

Current ownership is derived from the live cell's lock script.

Transfer and melt operations re-check the cell before the user signs, reducing the risk of acting on stale indexed ownership information.

### Fail-Closed Verification

The system does not return `valid` when it cannot establish a reliable verification result.

Infrastructure errors and unavailable chain data remain distinguishable from valid credentials.

### Public Verification Without Authentication

Public verification endpoints do not require a user session or wallet connection. This allows external users and applications to verify supported credentials without creating an account.

## Application Pages

| Route | Description |
|---|---|
| `/` | Chain status, credential counts and application entry points |
| `/credentials` | Browse and filter indexed credentials |
| `/credentials/:id` | Credential details, transfer and melt operations |
| `/issue` | Issue a Spore credential to a recipient |
| `/verify` | Public Spore credential verification |
| `/transactions` | Wallet write history and transaction status |

## Public Verification API

The backend exposes a family-agnostic verification interface.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/verify/families` | List available credential families |
| `POST` | `/api/verify` | Verify a credential using its family and identifier |
| `GET` | `/api/verify/:credentialId` | Spore-specific verification shortcut |
| `GET` | `/api/health` | Service health and best-effort CKB connectivity |
| `GET` | `/api/ready` | Readiness check |
| `GET` | `/api/version` | Public build and deployment metadata |

The canonical verification endpoint is `POST /api/verify`.

Example request:

```json
{
  "family": "spore",
  "identifier": "0x...",
  "expectedOwner": "ckt1..."
}
```

`expectedOwner` is optional. When supplied, the response includes an ownership comparison derived from the live cell's lock script.

For the complete request and response contract, see the [Backend Repository](https://github.com/BTThang/ckb-digital-credential-service).

## Screenshots

The following screenshots were captured against the production frontend during Week 12.

### Desktop — Public Verification

![Desktop verification page](https://raw.githubusercontent.com/BTThang/ckbuilder/main/week12/evidence/desktop/2026-11-10_desktop_verify-page_unconnected.png)

### Ownership MATCH

![Spore ownership MATCH](https://raw.githubusercontent.com/BTThang/ckbuilder/main/week12/evidence/desktop/2026-11-10_desktop_verify-match_spore.png)

### Ownership MISMATCH

![Spore ownership MISMATCH](https://raw.githubusercontent.com/BTThang/ckbuilder/main/week12/evidence/desktop/2026-11-10_desktop_verify-mismatch_spore.png)

The MATCH and MISMATCH scenarios demonstrate that ownership comparison is independent of credential validity.

### Mobile — Public Verification

![Mobile verification page](https://raw.githubusercontent.com/BTThang/ckbuilder/main/week12/evidence/mobile/2026-11-10_mobile_verify-page_unconnected.png)

Additional wallet and deployment evidence is available in the [Week 12 Final Report](https://github.com/BTThang/ckbuilder/blob/main/week12/ckb_weekly_report_w12.md).

## Production Deployment

The frontend and backend are deployed independently.

| Component | Platform | Production URL |
|---|---|---|
| Frontend | Vercel | [Open application](https://ckb-digital-credential-web.vercel.app/) |
| Backend | Render | [Open API](https://ckb-digital-credential-service.onrender.com/api) |
| Blockchain | Nervos CKB | Testnet |

### Production Build Identity

The final Week 12 audit recorded the following production build identities:

| Item | Frontend | Backend |
|---|---|---|
| Version | `1.0.0` | `1.0.0` |
| Environment | `production` | `production` |
| Network | `testnet` | `testnet` |
| Production commit | `c5db2d71e134e3a96b59f7ca7583650f199126c1` | `303b0fd87b22e095d16561a85c12ed8875cbcccc` |
| Hosting | Vercel | Render |

The final Week 12 read-only production audit confirmed:

- Frontend `/` and `/verify` returned HTTP 200.
- Frontend `/version.json` reported the expected production build identity.
- Backend `/api/version` reported the expected production build identity.
- Backend `/api/health` reported CKB Testnet reachable with an advancing chain tip.
- Backend `/api/verify/families` reported all three supported credential families.
- Deployed commits matched the corresponding repository HEAD and the Week 11 production baseline.

These are audit observations, not a guarantee of continuous availability.

## Quality Assurance

### Week 11 — Recorded Release-Gate Results

The following results were recorded during the Week 11 release gate:

| Test suite | Result |
|---|---:|
| Frontend Vitest | 173/173 passed |
| Playwright | 11/11 passed |
| Backend Vitest | 252/252 passed |
| Production acceptance | 19/19 passed |

These are historical Week 11 results. They were not re-executed during Week 12.

### Week 12 — Production Evidence and Handover

Week 12 focused on:

- Production evidence collection.
- Frontend and backend deployment traceability.
- Production endpoint and build metadata verification.
- Documentation review.
- Final evidence assessment and handover readiness.

The final evidence set contains 17 files.

The desktop disconnect evidence (E5) and mobile disconnect evidence (E7) are classified as PASS with notes. Their disconnect actions and resulting disconnected states were captured in separate sessions, not as continuous recordings. A completed switch to a second wallet account is not claimed.

**Final Week 12 status: PASS.**

For the detailed evidence register, audit history and handover assessment, see the [Week 12 Final Report](https://github.com/BTThang/ckbuilder/blob/main/week12/ckb_weekly_report_w12.md).

## Known Limitations

The project is currently deployed and validated on CKB Testnet. Mainnet deployment and validation have not been completed.

Documented operational limitations include:

- **Render free-tier cold starts:** The backend may take time to respond after an idle period.
- **Ephemeral SQLite storage:** The current deployment requires persistence planning or re-indexing after storage loss.
- **RPC dependency:** Verification availability depends on accessible CKB RPC infrastructure.
- **No uptime SLA:** Continuous availability and horizontal scaling are not guaranteed.
- **Issuer trust layer:** Issuer reputation and trust management are not implemented as a separate layer.
- **Deployment traceability:** Provider-side deployment event IDs and exact deployment timestamps were not fully verified in the Week 12 evidence.
- **Wallet switching evidence:** A completed switch to a second wallet account was not demonstrated in the final Week 12 evidence.

These limitations are documented as part of the project's handover assessment.

## Roadmap

Potential future improvements include:

1. Validate deployment and verification on CKB Mainnet.
2. Improve RPC resilience with dedicated or fallback providers.
3. Introduce persistent storage for the backend index.
4. Add monitoring and alerting for service health and chain availability.
5. Explore issuer reputation as a separate trust layer.
6. Expand automated end-to-end testing for real-wallet flows.
7. Improve operational readiness for broader adoption and horizontal scaling.

These are future directions, not claims of currently implemented functionality.

## Local Development

The frontend and backend are maintained in separate repositories. Run them independently during local development.

### Prerequisites

- Node.js >= 20.19
- npm
- A CKB-compatible browser wallet for wallet operations
- Access to CKB Testnet

### 1. Start the Backend

Clone the backend repository:

```bash
git clone https://github.com/BTThang/ckb-digital-credential-service.git
cd ckb-digital-credential-service
npm install
cp .env.example .env
npm run dev
```

The backend listens on `http://127.0.0.1:3000` by default.

See the [Backend Repository](https://github.com/BTThang/ckb-digital-credential-service) for environment configuration and service-specific instructions.

### 2. Start the Frontend

In a separate terminal:

```bash
git clone https://github.com/BTThang/ckb-digital-credential-web.git
cd ckb-digital-credential-web
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

The frontend uses CKB Testnet by default. Make sure the connected wallet is also configured for Testnet and uses `ckt1...` addresses.

For local development, configure `VITE_API_BASE_URL` to point to the backend running at `http://127.0.0.1:3000`.

The application requires CKB node access for chain reads. If no node is available, it displays an explicit error and retry option instead of silently showing incomplete data.

### Frontend Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite development server with HMR |
| `npm run build` | Typecheck and create the production build |
| `npm run preview` | Serve the built output |
| `npm test` | Run Vitest |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run typecheck` | Run TypeScript project checks |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with autofix |

### Frontend Environment Variables

The frontend reads environment variables at build time.

| Variable | Default | Description |
|---|---|---|
| `VITE_CKB_NETWORK` | `testnet` | CKB network configuration |
| `VITE_API_BASE_URL` | `http://127.0.0.1:3000` | Backend API base URL |
| `VITE_CKB_RPC_URL` | CCC public endpoints | Optional CKB RPC endpoint |
| `VITE_CKB_EXPLORER_URL` | CKB Explorer | Blockchain explorer URL |
| `VITE_WALLET_NAME` | `CKB Digital Credential` | Wallet sign-in application name |
| `VITE_WALLET_ICON` | Nervos favicon | Wallet sign-in application icon |

`VITE_CKB_NETWORK` must match the connected wallet's network.

### Project Structure

The frontend source is organized by application responsibility:

```text
src/
├── config/          # Network and environment configuration
├── context/         # CCC connector and wallet state
├── hooks/           # Shared React hooks
├── layouts/         # Application layouts
├── pages/           # Application routes
├── components/      # Reusable UI components
├── services/
│   ├── ckb/         # CKB client and chain reads
│   ├── wallet/      # Wallet connection and signing
│   ├── spore/       # Spore credential operations
│   ├── credentials/ # Credential use cases
│   └── transactions/# Local transaction history
├── api/             # Backend API client
├── types/           # Domain and API types
├── utils/           # Validation and formatting
└── test/            # Frontend test suites
```

### Important Implementation Notes

- UI components should remain presentational; data fetching belongs in pages and services.
- Services should not import from pages.
- Wallet key and signing logic stays within wallet and Spore service modules.
- CCC hooks must run inside the configured CCC Provider.
- The wallet connector owns its client lifecycle. Do not share a provider-owned client with unrelated services.

## Project Repositories and Documentation

| Resource | Description |
|---|---|
| [Frontend Repository](https://github.com/BTThang/ckb-digital-credential-web) | Web dApp and Spore credential lifecycle |
| [Backend Repository](https://github.com/BTThang/ckb-digital-credential-service) | Indexing, verification core and HTTP API |
| [CKB Builder Repository](https://github.com/BTThang/ckbuilder) | Development reports and project evidence |
| [Week 12 Final Report](https://github.com/BTThang/ckbuilder/blob/main/week12/ckb_weekly_report_w12.md) | Production audit, evidence register and handover assessment |

---

**Built on Nervos CKB · CKB Testnet · Version 1.0.0**
