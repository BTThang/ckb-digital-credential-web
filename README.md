# CKB Credential Verification Infrastructure

**Public, chain-derived digital credential verification on Nervos CKB.**

[Live Application](https://ckb-digital-credential-web.vercel.app/) · [Verify a Credential](https://ckb-digital-credential-web.vercel.app/verify) · [Frontend Repository](https://github.com/BTThang/ckb-digital-credential-web) · [Backend Repository](https://github.com/BTThang/ckb-digital-credential-service) · [Week 12 Report](https://github.com/BTThang/ckbuilder/blob/main/week12/ckb_weekly_report_w12.md)

![Network](https://img.shields.io/badge/Network-CKB%20Testnet-blue)
![Version](https://img.shields.io/badge/Version-1.0.0-green)
![Status](https://img.shields.io/badge/Week%2012-PASS-brightgreen)

---

## Overview

CKB Credential Verification Infrastructure is a digital credential system built on Nervos CKB.

It explores how digital credentials can be represented as real on-chain objects and independently verified using CKB's cell model, without relying on an application's database as the source of truth.

The system combines wallet-signed credential operations, a family-agnostic verification core, and a read-only backend index to provide a public and transparent credential verification experience.

Unlike conventional credential systems that depend on centralized databases for ownership information, this project derives credential existence and ownership from live on-chain state.

The infrastructure currently supports three credential families:

- **Spore:** Spore DOB credentials.
- **Vellum Claim:** `did:ckb` DID Metadata Cells.
- **CKB-PoP:** `dob-badge` cells.

The frontend provides the Spore credential lifecycle, while the backend verification service supports the three credential families through a shared verification architecture.

The project is deployed on CKB Testnet and includes a public web application and HTTP API.

## Quick Start

### Prerequisites

- Node.js >= 20.19
- npm
- A CKB-compatible browser wallet, such as JoyID
- Access to the CKB Testnet
- The backend service running for browsing and indexing features

### Installation

```bash
# Clone the frontend repository
git clone https://github.com/BTThang/ckb-digital-credential-web.git

# Navigate into the project
cd ckb-digital-credential-web

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env

# Start the development server
npm run dev
```

Open `http://localhost:5173`.

The application uses CKB Testnet by default. Your wallet must also be connected to Testnet, using `ckt1...` addresses.

The application requires CKB node access for chain reads. If no node is available, it displays an explicit error and retry option instead of silently showing incomplete data.

## Highlights

- **Real on-chain credentials:** Credentials are represented by actual CKB cells rather than database-only records.
- **Public verification:** Verify credentials without creating an account or connecting a wallet.
- **Three credential families:** A shared verification core supports Spore, Vellum Claim, and CKB-PoP.
- **Chain-authoritative ownership:** Ownership is derived from the live cell's lock script.
- **Wallet-signed transactions:** Users sign credential operations through their own wallets. The backend never holds user private keys.
- **Independent verification:** Indexed data is not treated as the authority for credential validity or ownership.
- **Fail-closed verification:** Infrastructure failures return `unable_to_verify` rather than an unsupported `valid` result.
- **Production deployment:** Frontend and backend are deployed separately on Vercel and Render.

## Features

### 1. Credential Lifecycle

The frontend supports the Spore credential lifecycle:

- Issue a credential through a wallet-signed transaction.
- Browse and manage credentials.
- View credential details.
- Transfer a credential to another owner.
- Melt a credential.
- Track wallet transactions and reconcile their status with chain state.

A transfer moves the existing Spore cell to a new owner while preserving its credential ID. Melting destroys the cell, after which verification reports `not_found`.

### 2. Multi-family Credential Verification

The backend verification service supports three credential families:

| Family | On-chain object | Verification source |
|---|---|---|
| Spore | Spore cell | Live cell state and committed creation transaction, with optional issuer proof |
| Vellum Claim | `did:ckb` DID Metadata Cell | Live on-chain DID metadata |
| CKB-PoP | `dob-badge` cell | Live cell matching the configured code hash |

Each family has its own verifier, while sharing a common verification core and consistent verdict vocabulary.

### 3. Public Credential Verification

The public verification experience allows users to check credentials without an account or connected wallet.

Capabilities include:

- Check whether a credential exists on-chain.
- Determine the current owner from the live cell's lock script.
- Compare the actual owner with an optional expected owner.
- Distinguish credential validity from ownership comparison.
- Share public verification results through URLs.
- Inspect issuer proof when a source-backed proof is available.

An ownership mismatch does not automatically mean the credential itself is invalid.

### 4. Wallet Integration

- Connect through CKB-compatible wallets, including JoyID.
- Authenticate using wallet-based identity rather than passwords.
- Sign credential write transactions in the browser.
- Keep private keys and signing operations outside the backend.

### 5. Backend Indexing and Transaction Tracking

The backend provides:

- Read-only credential indexing.
- Transaction tracking and reconciliation.
- Chain health information.
- Public version and build metadata.
- Credential-family discovery.
- Verification API endpoints.

The backend index improves browsing and application performance but is not the authority for credential ownership or verification.

## How Verification Works

The verification process follows a chain-authoritative model.

```text
User / External Application
          |
          v
  Public Verification
       Interface
          |
          v
  Backend Verification API
          |
          v
  Family-Agnostic Core
          |
          +--------------------+
          |         |          |
          v         v          v
        Spore    Vellum      CKB-PoP
       Verifier  Verifier    Verifier
          |         |          |
          +---------+----------+
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

At a high level:

1. A user or external application submits a credential identifier and, where required, a credential-family hint.
2. The backend routes the request to the appropriate family-specific verifier.
3. The verifier checks the relevant on-chain object and its state.
4. Ownership is derived from the live cell's lock script where applicable.
5. The verification core produces a consistent result.
6. The result is returned to the public interface or API consumer.

The index can assist with discovery and lookup, but the chain remains authoritative.

### Verification Result Semantics

The system distinguishes between credential state and verification capability.

- `valid`: The credential passes the applicable verification checks.
- `not_found`: The required on-chain credential object cannot be found.
- `unable_to_verify`: The system cannot establish a reliable result, for example because of infrastructure or chain-access failures.

An infrastructure failure must never be interpreted as proof that a credential is valid.

## Architecture

The system consists of two independently deployed repositories.

| Component | Technology | Responsibility |
|---|---|---|
| Frontend | React 19, TypeScript, Vite | User interface, wallet connection, credential operations and public verification |
| Backend | Express 5, TypeScript, SQLite | Read-only indexing, transaction tracking and verification API |
| Blockchain | Nervos CKB Testnet | On-chain credential objects and ownership state |
| Wallet | CCC / JoyID | Wallet connection and transaction signing |
| Frontend hosting | Vercel | Production web application |
| Backend hosting | Render | Production API service |

### Frontend Repository

[ckb-digital-credential-web](https://github.com/BTThang/ckb-digital-credential-web)

Responsible for:

- Wallet connection and authentication.
- Spore credential issuance.
- Credential browsing and management.
- Transfer and melt operations.
- Public verification interface.
- Transaction history and status tracking.

### Backend Repository

[ckb-digital-credential-service](https://github.com/BTThang/ckb-digital-credential-service)

Responsible for:

- Credential indexing.
- Chain-derived verification.
- Multi-family verification.
- Transaction tracking.
- Public API and service health.
- Build metadata and version traceability.

## Security and Trust Model

The project follows several important security principles.

### On-chain State Is Authoritative

The live CKB cell is the source of truth for credential existence and ownership.

The database is an index, not an independent authority.

### Wallet-Signed Writes

Credential write transactions are signed through the user's own wallet.

The backend does not hold private keys or sign transactions on behalf of users.

### Ownership Verification

The current owner is derived from the live cell's lock script.

Transfer and melt operations re-check the cell before allowing the user to sign, reducing the risk of acting on stale indexed ownership information.

### Fail-Closed Verification

The system does not return `valid` when it cannot establish a reliable verification result.

Infrastructure errors and unavailable chain data must remain distinguishable from valid credentials.

## Application Pages

| Route | Description |
|---|---|
| `/` | Chain status, counts and application entry points |
| `/credentials` | Browse and filter indexed credentials |
| `/credentials/:id` | Credential details, transfer and melt operations |
| `/issue` | Issue a Spore credential to a recipient |
| `/verify` | Public Spore credential verification |
| `/transactions` | Wallet write history and transaction status |

## Screenshots

The following screenshots were independently captured against the production frontend during Week 12.

### Desktop Verification

![Desktop verification page](https://raw.githubusercontent.com/BTThang/ckbuilder/main/week12/evidence/desktop/2026-11-10_desktop_verify-page_unconnected.png)

### Ownership MATCH

![Spore ownership MATCH](https://raw.githubusercontent.com/BTThang/ckbuilder/main/week12/evidence/desktop/2026-11-10_desktop_verify-match_spore.png)

### Ownership MISMATCH

![Spore ownership MISMATCH](https://raw.githubusercontent.com/BTThang/ckbuilder/main/week12/evidence/desktop/2026-11-10_desktop_verify-mismatch_spore.png)

The ownership comparison is independent of credential validity.

### Mobile Verification

![Mobile verification page](https://raw.githubusercontent.com/BTThang/ckbuilder/main/week12/evidence/mobile/2026-11-10_mobile_verify-page_unconnected.png)

Additional wallet and deployment evidence is documented in the Week 12 report.

## Production Deployment

| Component | Platform | Status |
|---|---|---|
| Frontend | Vercel | Production |
| Backend | Render | Production |
| Blockchain | CKB Testnet | Reachable during final audit |

### Live URLs

- Application: https://ckb-digital-credential-web.vercel.app/
- Public verification: https://ckb-digital-credential-web.vercel.app/verify
- Backend API: https://ckb-digital-credential-service.onrender.com/api

### Production Build Identity

| Item | Frontend | Backend |
|---|---|---|
| Version | `1.0.0` | `1.0.0` |
| Environment | `production` | `production` |
| Network | `testnet` | `testnet` |
| Production commit | `c5db2d71e134e3a96b59f7ca7583650f199126c1` | `303b0fd87b22e095d16561a85c12ed8875cbcccc` |

The final Week 12 read-only production audit confirmed:

- Frontend `/` and `/verify` return HTTP 200.
- Frontend `/version.json` reports the expected production build identity.
- Backend `/api/version` reports the expected production build identity.
- Backend `/api/health` reports CKB Testnet reachable with an advancing chain tip.
- Backend `/api/verify/families` reports all three supported families.

The deployed commits match the corresponding repository HEAD and the Week 11 production baseline.

## Quality Assurance

The recorded Week 11 release-gate results were:

| Test suite | Result |
|---|---:|
| Frontend Vitest | 173/173 passed |
| Playwright | 11/11 passed |
| Backend Vitest | 252/252 passed |
| Production acceptance | 19/19 passed |

These are historical Week 11 results and were not re-executed during the Week 12 documentation and production audit.

Week 12 focused on production evidence, deployment traceability, documentation review and handover readiness.

**Final Week 12 status: PASS.**

The final evidence set contains 17 files, including desktop, mobile and deployment evidence. E5 (desktop disconnect) and E7 (mobile disconnect) are both classified PASS with notes. Their action and resulting-state screenshots come from separate sessions, not continuous recordings.

## Known Limitations

The system is currently validated on CKB Testnet. Mainnet deployment and validation have not been completed.

Other documented operational considerations include:

- Render free-instance cold starts.
- Ephemeral SQLite storage and the need for persistence or re-sync.
- RPC availability and resilience.
- Provider deployment event IDs and exact deployment timestamps not fully verified.
- A completed switch to a second wallet account is not demonstrated by the final Week 12 evidence.
- No uptime SLA or horizontal scaling guarantee.
- Issuer trust and reputation are not currently implemented as a separate layer.

These limitations are documented and do not change the final Week 12 PASS classification.

## Roadmap and Potential Improvements

Potential future work includes:

1. Validate a CKB Mainnet deployment.
2. Improve RPC resilience through dedicated or fallback providers.
3. Add persistent storage for the backend index.
4. Introduce monitoring and alerting for service health and chain availability.
5. Explore issuer reputation as a separate trust layer.
6. Expand automated end-to-end testing for real-wallet flows.
7. Improve operational readiness for broader adoption and horizontal scaling.

These are future directions, not claims of currently implemented functionality.

## Local Development

### Available Scripts

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

### Environment Variables

The frontend reads environment variables at build time.

| Variable | Default | Description |
|---|---|---|
| `VITE_CKB_NETWORK` | `testnet` | CKB network (`testnet` or `mainnet`) |
| `VITE_API_BASE_URL` | `http://127.0.0.1:3000` | Backend API base URL |
| `VITE_CKB_RPC_URL` | CCC public endpoints | Optional CKB RPC endpoint |
| `VITE_CKB_EXPLORER_URL` | CKB Explorer | Blockchain explorer URL |
| `VITE_WALLET_NAME` | `CKB Digital Credential` | Wallet sign-in application name |
| `VITE_WALLET_ICON` | Nervos favicon | Wallet sign-in application icon |

`VITE_CKB_NETWORK` must match the connected wallet's network.

For local development, make sure the backend API URL points to your running backend service.

### Project Structure

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
│   ├── transactions/# Local transaction history
│   └── api/         # Backend API client
├── types/           # Domain and API types
├── utils/           # Validation and formatting
└── test/            # Frontend test suites
```

### Important Implementation Notes

- UI components should remain presentational; data fetching belongs in pages and services.
- Services should not import from pages.
- Wallet key and signing logic stays within wallet and Spore service modules.
- CCC hooks must run inside the configured CCC Provider.
- The wallet connector owns its client lifecycle; do not share a provider-owned client with unrelated services.

## Project Documentation

For implementation details and verification evidence, see:

- [Frontend source code](https://github.com/BTThang/ckb-digital-credential-web)
- [Backend source code](https://github.com/BTThang/ckb-digital-credential-service)
- [CKB Builder development repository](https://github.com/BTThang/ckbuilder)
- [Week 12 final report](https://github.com/BTThang/ckbuilder/blob/main/week12/ckb_weekly_report_w12.md)

The Week 12 report contains the full production evidence register, deployment traceability audit, final mobile evidence resolution and handover assessment.

---

**Built on Nervos CKB · CKB Testnet · Version 1.0.0**

