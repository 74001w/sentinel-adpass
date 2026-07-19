Sentinel-AdPass
Product Requirements Document: Net New Build

Build name:  Sentinel-AdPass
Owner:  Vincent Mizhquiri, Rufino Morales, Jimmy Ong, Rob Walker
Date:  July 19, 2026
1. PROBLEM
Advertisers experience slow, manual ad-policy review before their ads can enter a streaming platform's ad auction, because today these reviews still require manual work, resulting in delayed campaigns, increased advertiser friction, and a greater risk that unsafe or misleading ads slip through. At Netflix's scale, where ML Engineer job postings describe large-scale advertising systems, even small review delays can affect advertiser trust, time-to-market, and brand safety.
Supporting Context (optional)
A manual policy review typically takes a human several minutes per ad.
The gap shows up even at large, well-resourced platforms: Netflix's own ML Engineer job postings describe the need for faster, large-scale advertising review systems, and also point to an opportunity to reduce advertiser friction through a repeatable Human-in-the-Loop review process.
1a. Opportunity
Sentinel-AdPass proves out an AI-assisted, human-approved ad review model for a streaming ad market that's already worth tens of billions of dollars a year and still growing fast, at a moment when platforms are pulling back from their own safety checks while regulators are asking for more transparency, not less.
Market Opportunity
US streaming TV (CTV) ad spend is projected at roughly $38 billion in 2026, growing about 14% year over year.
The ad verification market (the category Sentinel-AdPass's review layer fits into) was worth about $4.8 billion in 2024 and is growing faster than streaming ad spend itself, at roughly 15% a year.
Some major platforms are actually stepping back from independent safety audits right now (Meta dropped out of one in late 2025), while regulators are pushing the opposite direction on transparency, so the gap this kind of review system fills is getting wider, not smaller.
1b. Users & Needs
Primary user(s):  Advertiser — submits ads and needs them reviewed quickly and fairly so campaigns aren't delayed.
Secondary users:  Reviewer — the human who makes the final approve/reject call on every ad before it can enter the auction.
Key User Needs
As an advertiser, I need my ad reviewed quickly because manual review today takes several minutes per ad and delays my campaign.
As a reviewer, I need a pre-flagged, structured summary of an ad's policy issues because evaluating a blank ad from scratch is slow and inconsistent.

2. PROPOSED SOLUTION
Sentinel-AdPass is a review pipeline that sits between an advertiser submitting an ad and that ad entering a simulated advertising auction. Users simply submit an ad with a headline, media URL, and bid amount, and the system runs it through an AI policy review followed by mandatory human reviewer approval before it can compete for an auction slot. As a result, advertisers get pre-flagged, explainable feedback in seconds instead of waiting minutes for a fully manual review, while a human still makes every final call.
2a. Value Proposition
Advertisers who struggle with slow, manual ad-policy review use Sentinel-AdPass, an AI-assisted review pipeline, to get ads evaluated against policy rules in seconds instead of minutes. Unlike a fully manual review process, it pairs fast AI-driven policy checks with mandatory human approval and a bid-and-quality auction, helping ads move faster without giving up human control over the final decision.
2b. Top 3 MVP Value Props
The Vitamin (must-have baseline): Every ad is checked against a consistent set of policy rules — banned words, missing disclosures, bid range, and image dimensions — before it can be reviewed.
The Painkiller (solves the core pain): AI completes the initial policy review in seconds instead of the several minutes a manual review takes, removing the slow first pass while the human still makes the final call.
The Steroid (the magic moment): A newly approved ad can bump a weaker ad out of an auction slot live, showing in real time that ranking rewards both a strong bid and a clean policy review, not bid alone.
2c. Goals & Non-Goals
Goals
Prove that AI-assisted review + mandatory human approval can speed up ad review without weakening trust or brand safety.
Prove that a simulated auction can rank ads on both bid and policy-review quality, not bid alone.
Prove the AI guard can resist a light adversarial manipulation attempt without needing a full production-scale defense.

Non-Goals
Real-time bidding at production scale (1M+ QPS).
Real advertiser accounts, real payments, real authentication.
Live video rendering or verified media hosting.
Multiple reviewer workflows (data model supports adding later).
Live resubmission flow (data model supports adding later).
Top-bid tie-breaker (isolated logic supports swapping later).
ML model training, production deployment, full race-condition handling at scale.
Downstream analytics reuse of ad data.

2d. Success Metrics

Goal
Signal
Metric
Target
Speed up ad review with AI + mandatory human approval
AI review returns structured results quickly under normal conditions
AI policy review completion time
Within 10 seconds (soft target)
No ad bypasses human judgment
Every ad that reaches the auction has a recorded reviewer decision
% of auctioned ads with a recorded human decision
100%, no exceptions, even in the AI-failure case
Auction ranks on quality as well as bid
A newly approved ad bumps a weaker ad out of a slot
Live slot-bump shown in demo
At least 1 successful live bump during the demo
AI guard resists adversarial manipulation
The seeded adversarial ad is flagged, not silently approved
Adversarial test case result
Flagged with severity "high"; reviewer sees the same structured format


3. REQUIREMENTS
User Journey 1: Advertiser submitting an ad for review
Context:  Advertisers need their ad checked against policy rules quickly and clearly before it can compete for an auction slot.

Sub-journey: Submitting an ad
[P0] User can submit an ad with a headline (1–100 characters).
[P0] User can submit an ad with a media URL (valid http/https format).
[P0] User can submit an ad with a bid amount.
[P0] User sees a specific, human-readable error immediately if any submitted field fails validation.

Sub-journey: Receiving AI policy review results
[P0] User can see a structured pass/fail card with a plain-language reason for each policy rule checked (banned words, missing disclosures, bid range, image dimensions).
[P1] User can see the manipulation-attempt check flagged as a high-severity card if triggered.
[P1] If the AI review is unavailable, user's ad is held pending with a note that it will be reviewed manually instead of being silently approved or dropped.
[P2] User can see high-severity cards displayed with a distinct red banner and warning icon.

User Journey 2: Reviewer approving or rejecting ads
Context:  The reviewer is the final decision-maker; no ad can enter the auction without a recorded human decision.
Sub-journey: Reviewing a submitted ad
[P0] User can view a list of pending ads.
[P0] User can view one ad's full details, including all of its AI review cards.
Sub-journey: Making a decision
[P0] User can approve an ad, which immediately enters it into the auction pool.
[P0] User can reject an ad, which finalizes its status for the demo.
[P2] User is prevented from submitting a second decision on an ad that already has a recorded decision.
Sub-journey: Selecting a role
[P0] User can select either the Advertiser view or the Reviewer view from a dropdown/toggle at the start of the session (no real authentication in the MVP).

User Journey 3: Viewing live action results
Context:  Approved ads compete for a limited number of auction slots based on bid and quality score, and slots stay competitive as new ads are approved.
Sub-journey: Viewing ranked results
[P0] User can view the current ranked results across all auction slots.
[P0] User can see each slot's ad, bid amount, quality score, final rank score, and a plain-language reason for its ranking.
[P0] User can see a newly approved ad bump a weaker ad out of a slot, live.

4. APPENDIX
Tech Stack: Frontend (HTML/CSS/vanilla JavaScript), Backend (Node.js + Express), Database (Supabase/PostgreSQL), AI Review Engine (Anthropic Claude API), Hosting (local, for demo).
Ownership Map: Rob — data models, API contracts, AI review/quality score/auction ranking, access control, adversarial test case. Vince — submission + reviewer frontend. Rufino — results dashboard. Jimmy — seeded test scenarios, test data, demo pacing.
Source: This PRD is adapted from the team's "Wk-7 Final PRD" (Sentinel-AdPass, Pursuit L2, Cycle 4, Week 7).

