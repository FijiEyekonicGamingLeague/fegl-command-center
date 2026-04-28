# FEGL Command Center — Final Frontend MVP

This is a deploy-ready static frontend prototype for Fiji Eyekonic Gaming League.

## What is included

- Home / REIGNITE landing page
- Season Hub: IGNITE → REIGNITE
- Fixtures with allowed club-star caps
- Club Freedom System wording
- Live standings after admin approval
- Player registry and FEGL IDs
- Results feed
- Submit Result mock flow
- Rules page
- Archive / Hall of Flame page
- Backend schema explainer
- Admin mock panel
- Mock approval engine showing standings, ELO and card movement
- Social placeholders for YouTube, Facebook, Discord, Instagram and TikTok

## How to preview

Open `index.html` in a browser.

For the mock motion:

1. Open the Admin page.
2. Click Approve on `AlphaFlame 4-3 DaloWarrior`.
3. Check Standings, Results and Players.
4. ELO, table and card identity should move.
5. Use Reset Mock to return to zero.

## How to deploy free early

Upload the whole folder to any static hosting service. The site does not require npm or a build step.

Recommended early structure:

- Static frontend: this folder
- Database later: Supabase
- Backup: weekly CSV export
- Heavy proof/video files: keep outside the database early

## Where to change social links

Open `app.js` and replace the values in `SOCIAL_LINKS`, then also update the footer links in `index.html` if you want them hardcoded there.

## Next build step

Connect this frontend to Supabase using the SQL schema in `database/supabase_schema_and_engines.sql`.

