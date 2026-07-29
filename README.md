# Sentinel-AdPass

A review pipeline that sits between an advertiser submitting an ad and that ad entering a simulated advertising auction. An AI performs the initial policy review quickly; a human reviewer makes the final approval decision before an ad is allowed into the auction.

**Disclaimer:** Sentinel-AdPass is an independent student project inspired by publicly available Netflix job postings, used only as research to shape a realistic pain point and system design. It is not affiliated with, endorsed by, or built for Netflix.

Full product details live in the [PRD](./docs/Sentinel-AdPass_PRD.docx), read it before writing any code.

## The Problem

Before an ad can be shown to users, it must be reviewed to make sure it follows company policies. Today, many of these reviews still require manual work. That slows advertisers down, delays campaigns, and increases the risk that unsafe or misleading ads could slip through. At scale, even small delays can affect advertiser trust, time-to-market, and brand safety.

Sentinel-AdPass solves this with an AI performing the initial policy review quickly, while a human reviewer makes the final approval decision before an ad is allowed into the auction.

## Screenshots

### Ad Submission
Advertiser view — every ad is checked against policy before it can enter the auction.

![Ad Submission](docs/screenshots/submission-screen.png)

### Reviewer — Manipulation Attempt Caught
An adversarial ad with an embedded instruction trying to trick the AI reviewer into auto-approving it. The manipulation attempt check catches it and flags it as high severity, never following the embedded instruction.

![Manipulation Attempt Flagged](docs/screenshots/manipulation-flag.png)

### Auction Dashboard — Live Ranking
Approved ads ranked by combined bid and quality score, updating live as new ads are approved.

![Auction Ranking](docs/screenshots/dashboard-ranking.png)

### Auction Dashboard — Rejected Bids
Ads that didn't pass review, shown for visibility alongside the live ranking.

![Rejected Bids](docs/screenshots/dashboard-rejected.png)

---

## Project Structure

- `frontend/` — everything the browser loads (HTML, CSS, JS)
  - `index.html` — Advertiser submission + Reviewer queue/detail (toggle at the top)
  - `dashboard.html` — live auction ranking + rejected bids
- `backend/` — the server, database code, and seed script
- Run all backend commands (`npm install`, `npm run dev`, `node seed.js`) from inside the `backend/` folder, not the project root

---

## Team

| Person | Lane |
|---|---|
| Rob Walker | Backend, AI review logic, auction engine (PRD §3, §4, §5.2–5.6) |
| Vince Mizhquiri | Frontend — submission + reviewer screens (consumes §4.1, §4.4) |
| Rufino Morales | Frontend — auction results dashboard (consumes §4.2, §4.5) |
| Jimmy Ong | Seeded test scenarios, test data, demo pacing (PRD §8) |

---

## Tech stack

- Frontend: HTML / CSS / vanilla JavaScript
- Backend: Node.js + Express
- Database: Supabase (PostgreSQL)
- AI: Anthropic Claude API

---

## First-day setup checklist

Run this in order, before writing any new code:

1. Clone the repo
2. `cd backend`
3. Copy `.env.example` to `.env`, fill in your real values
4. Confirm your Node version matches the team's agreed version (`node -v`)
5. Create the local database using the exact agreed name: `sentinel_adpass`
6. Run the seed script (`node seed.js`), confirm it completes with no errors
7. Confirm the backend starts locally with no errors (`npm run dev`) before writing any new code

---

## Branch structure

- `main` is protected, always working, never pushed to directly
- Each person works in their own branch:
  - `rob-backend`
  - `vince-frontend`
  - `rufino-dashboard`
  - `jimmy-testdata`
- Open a pull request into `main` when a piece is ready. Get one teammate to glance at it before merging.
- Pull from `main` often, especially around the integration checkpoint below.

---

## Shared vocabulary

Every exact value/format (IDs, statuses, timestamps, the AI explanation card shape) lives in **PRD §7**. If you need to add or change something in that list, flag it in the group chat first:

> ⚠️ VOCAB CHANGE — [what changed] — [why] — please re-check your code

No silent changes. Update the PRD's change log once agreed.

---

## Integration checkpoints

- **Day 1:** everyone runs the setup checklist together, live
- **End of week 1:** midpoint integration checkpoint, connect whatever exists so far, even incomplete
- **Day before demo:** final integration pass + full demo rehearsal

---

## API quick reference

See PRD §4 for full request/response contracts.

- `POST /api/ads` — submit a new ad
- `GET /api/ads?status=pending|approved|rejected` — list ads, optionally filtered
- `GET /api/ads/:adId` — one ad's full details
- `POST /api/ads/:adId/review` — reviewer decision
- `GET /api/auction/results` — current ranked results
