# Build Spec — Local Business Lead Generator
**Split for 2 developers working in parallel**

---

## System Overview

A local HTML frontend where a user inputs a business category (e.g. "nail salons in SF"). The pipeline runs fully automatically — finding no-website businesses, generating landing pages, deploying via Render. Each business card shows a pre-filled email draft to copy manually, or a phone number to call if no email was found. Cards can be saved for later and recalled with a toggle.

**Stack:**
- Frontend: plain HTML/JS (local only, no deployment)
- Backend: Node.js
- Google Places API — find businesses, filter no-website
- Yutori Research API — research each business, infer style
- Fastino API — landing page generation (endpoint TBD)
- Render CLI — auto-deploy generated sites
- Local JSON — storage (no database)
- Gmail — pre-filled email copy displayed in UI for manual sending (no API/auth required)

**Local folder structure:**
```
/websites
  /luxe-nails/
    index.html
/data
  businesses.json
  generated.json
```

---

## ⚠️ Changes (Latest)

**Pipeline is now fully automatic — no approve-before-generate step.**

Previously: user approved → generation triggered.
Now: typing in the search box kicks off the entire pipeline automatically — research, site generation, Render deploy all happen in the background. By the time cards appear, the site is already live. User only decides whether to **send the email or not**.

Affected areas:
- `/api/search` now chains directly into generation + deploy — no separate `/api/generate` call from the frontend
- Frontend approval button is now **"Send Email" / "Skip"** only
- `POST /api/generate` is called server-side automatically per business, not triggered by the user
- Card state on load already shows the live URL

**Update 2 — No Gmail API, no Send/Skip buttons.**

No Google auth. No send button. Instead each card shows:
- A pre-filled email draft (editable textarea) the user copies manually
- Phone number to call if no email found
- **"Save for Later"** button — hides the card
- **"Show Saved for Later"** toggle at the top to reveal hidden cards

---

## Full User Flow

### What the user sees and does, start to finish

---

**1. Open the app**
User opens `index.html` in their browser. Single search input, nothing else.

```
┌─────────────────────────────────────────┐
│  🍽 Platter                              │
│                                         │
│  [ nail salons in San Francisco       ] │
└─────────────────────────────────────────┘
```

Input: free text. As soon as the user stops typing (debounce ~800ms) or hits Enter, the full pipeline fires automatically. No submit button needed.

---

**2. Pipeline runs in the background**
Google Places → filter no-website → Yutori research → Fastino generation → Render deploy — all automatic. Cards stream in as each business completes.

```
┌─────────────────────────────────────────┐
│  Finding businesses...                  │
│                                         │
│  ⏳ Luxe Nails — building site...       │
│  ✅ Golden Gate Cuts — site ready       │
│  ⏳ Bay Brow Studio — researching...    │
└─────────────────────────────────────────┘
```

---

**3. Cards ready — user reaches out manually**
Each card arrives fully cooked: site deployed, live URL included. No buttons to send — user copies the pre-filled email draft or calls if no email found.

```
┌─────────────────────────────────────────┐
│  Luxe Nails                             │
│  123 Market St, San Francisco           │
│  📞 415-555-1234                        │
│  ✉️  hello@luxenails.com                │
│  ⭐ 4.3  (142 reviews)                  │
│  🎨 Style: warm and luxurious           │
│  "A cozy nail salon in the Mission..."  │
│  🌐 luxe-nails-xyz.onrender.com         │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Hi, we noticed you don't have   │   │
│  │ a website so we built one for   │   │
│  │ you: luxe-nails-xyz.onrender.com│   │
│  │ — Platter                       │   │
│  └─────────────────────────────────┘   │
│  [ Copy Email ]                         │
│                                         │
│  [ 🕓 Save for Later ]                  │
└─────────────────────────────────────────┘
```

**If no email found:**
```
┌─────────────────────────────────────────┐
│  Luxe Nails                             │
│  ✉️  Email not found                    │
│  📞 Call instead: 415-555-1234          │
│  🌐 luxe-nails-xyz.onrender.com         │
│                                         │
│  [ 🕓 Save for Later ]                  │
└─────────────────────────────────────────┘
```

---

**4. Save for Later**
Clicking "Save for Later" hides the card from the main view. Status saved as `saved` in `businesses.json`.

A toggle appears (or stays visible) at the top of the page:

```
[ Show Saved for Later (3) ]
```

Clicking it reveals all hidden cards in a collapsed section below the active feed.

---

**5. End state**

```
┌─────────────────────────────────────────┐
│  10 businesses found. [ Show Saved (3) ]│
└─────────────────────────────────────────┘
```

---

**7. Cron job (no user interaction)**
Runs daily at 9am. Full pipeline runs automatically — research, generation, deploy. User opens the app and sees cards already built, waiting only for the send/skip decision.

---

## Cron Job Flow (runs daily)

```
cron (daily)
  → Google Places: search category, filter has_website=false
  → For each business: Yutori Research to get details + infer style
  → Save to businesses.json
  → For each: Fastino generates HTML → saved to /websites/{slug}/index.html
  → Render CLI: deploy /websites/{slug}/
  → Create Gmail draft with live URL + custom copy
```

---

## Developer A — Business Discovery Pipeline

### Responsibility
Backend pipeline: Google Places search → filter no-website → Yutori research → style inference → local JSON.

---

### Data Source: Google Places API

**Why this works for no-website businesses:**
Google Places returns a `website` field. If absent → business has no website. Filter on this.

**Find businesses:**
```
GET https://maps.googleapis.com/maps/api/place/textsearch/json
  ?query=nail+salons+in+San+Francisco
  &key=${GOOGLE_PLACES_API_KEY}
```

**Get place details (website, phone, reviews):**
```
GET https://maps.googleapis.com/maps/api/place/details/json
  ?place_id={place_id}
  &fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,editorial_summary
  &key=${GOOGLE_PLACES_API_KEY}
```

Filter: keep only records where `website` field is absent.

---

### Yutori Research — Business Enrichment + Style Inference

For each no-website business, create a Yutori Research task to:
1. Find any info about the business online (Yelp, Facebook, directories)
2. Infer a visual style based on the type of business, neighborhood, reviews

**Create task:**
```
POST https://api.yutori.com/v1/research
Authorization: Bearer ${YUTORI_API_KEY}
Content-Type: application/json

{
  "query": "Research 'Luxe Nails' at 123 Market St San Francisco. Find: any email address, social media links, description of the business vibe. Then suggest a visual website style (e.g. 'modern minimalist', 'warm and luxurious', 'clean and clinical') based on what you find."
}
```

**Poll for completion:**
```
GET https://api.yutori.com/v1/research/{task_id}
Authorization: Bearer ${YUTORI_API_KEY}
```
Poll every 3s, timeout at 120s.

**Parse the result text to extract:**
- `email` (if found, else null)
- `style` (e.g. "warm and luxurious")
- `description` (1-2 sentence business summary)

---

### Endpoints to Build

#### `POST /api/search`
**Request:**
```json
{ "query": "nail salons in San Francisco" }
```

**Flow:**
1. Google Places textsearch → get place IDs
2. Google Places details for each → filter `has_website=false`
3. For each: kick off Yutori Research task (store `task_id` per business)
4. Return immediately with a `search_id`

**Response:**
```json
{ "search_id": "uuid" }
```

#### `GET /api/search/:search_id/status`
Polls individual Yutori tasks internally, aggregates status.

**Response:**
```json
{
  "status": "pending" | "processing" | "completed" | "failed",
  "completed": 4,
  "total": 10
}
```

#### `GET /api/results/:search_id`
Returns enriched businesses once all Yutori tasks complete.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Luxe Nails",
    "address": "123 Market St, SF",
    "phone": "415-555-1234",
    "email": "hello@luxenails.com",
    "has_website": false,
    "google_reviews": 142,
    "google_rating": 4.3,
    "style": "warm and luxurious",
    "description": "A cozy nail salon in the Mission known for gel sets and friendly staff.",
    "slug": "luxe-nails"
  }
]
```

#### `POST /api/businesses/save`
Writes results array to `data/businesses.json`.

---

### Local JSON Schema — `data/businesses.json`
```json
[
  {
    "id": "uuid",
    "name": "Luxe Nails",
    "address": "123 Market St, SF",
    "phone": "415-555-1234",
    "email": "hello@luxenails.com",
    "has_website": false,
    "google_reviews": 142,
    "google_rating": 4.3,
    "style": "warm and luxurious",
    "description": "...",
    "slug": "luxe-nails",
    "status": "pending" | "approved" | "skipped" | "generated" | "deployed"
  }
]
```

---

## Developer B — Approval UI, Generation & Deploy

### Responsibility
Local HTML frontend + backend endpoints for approval, Fastino generation, Render deploy, Gmail draft.

---

### Frontend (`index.html`)

**Step 1 — Search**
- Text input: business category
- Submit → `POST /api/search` → store `search_id`
- Poll `GET /api/search/:search_id/status` every 3s → show progress (`4/10 researched...`)
- On complete → fetch `GET /api/results/:search_id` → render cards

**Step 2 — Business Cards**

Each card shows:
- Name, address, phone
- Email (or "Email not found" in grey)
- Google rating + review count
- Inferred style tag (e.g. "warm and luxurious")
- Business description
- ✅ Approve / ❌ Skip

**Step 3 — On Approve**
Calls `POST /api/generate` → shows spinner → on success shows:
- "Site generated & deployed"
- Live Render URL (clickable)
- "Gmail draft created ✓"

---

### Endpoints to Build

#### `PATCH /api/businesses/:id`
Updates status field in `data/businesses.json`.

**Request:** `{ "status": "approved" | "skipped" }`

#### `POST /api/generate`
**Request:**
```json
{
  "id": "uuid",
  "name": "Luxe Nails",
  "description": "A cozy nail salon in the Mission...",
  "style": "warm and luxurious",
  "phone": "415-555-1234",
  "address": "123 Market St, SF"
}
```

**Flow:**
1. Call Fastino API — **endpoint TBD** — pass `name`, `description`, `style`
2. Receive HTML back
3. Write to `websites/{slug}/index.html`
4. Run `render deploy --dir websites/{slug}` via Node `child_process.exec`
5. Parse live URL from Render CLI output
6. Update `data/generated.json` with business + live URL
7. Call `POST /api/email/draft` internally

**Response:**
```json
{
  "live_url": "https://luxe-nails-xyz.onrender.com",
  "business_name": "Luxe Nails"
}
```

#### Email Draft (no endpoint needed)
No Gmail API. No auth. The backend includes a `emailDraft` string in the `/api/generate` response. The frontend renders it as an editable textarea with a "Copy" button.

**Draft template (generated server-side):**
```
Subject: We built you a free website

Hi {name},

We noticed you didn't have a website so we built one for you — take a look:
{live_url}

Happy to chat if you have questions.
— Platter
```

If `email` is null, frontend shows phone number instead with label "Call instead".

---

### Local JSON Schema — `data/generated.json`
```json
[
  {
    "id": "uuid",
    "name": "Luxe Nails",
    "slug": "luxe-nails",
    "live_url": "https://luxe-nails-xyz.onrender.com",
    "email": "hello@luxenails.com",
    "generated_at": "2026-02-27T10:00:00Z",
    "status": "active" | "saved"
  }
]
```

---

## Cron Job — `cron.js`

Owned by **Dev A**. Runs the full pipeline end-to-end on a schedule.

```js
// runs daily at 9am
cron.schedule('0 9 * * *', async () => {
  const categories = ["nail salons in San Francisco", "fishing shops in San Francisco"]
  for (const query of categories) {
    await fetch('http://localhost:3000/api/search', {
      method: 'POST',
      body: JSON.stringify({ query })
    })
  }
})
```

Use `node-cron` package. Categories are hardcoded for v1 — make it a config array at the top of the file.

---

## Shared Environment Variables (`.env`)
```
YUTORI_API_KEY=<your-yutori-key>
GOOGLE_PLACES_API_KEY=<your-google-places-key>
PIONEER_API_KEY=<your-pioneer-key>
PIONEER_ENDPOINT=<your-pioneer-endpoint>
PIONEER_MODEL_ID=<your-pioneer-model-id>
```

---

## Open Questions
1. **Fastino endpoint** — URL + request/response format (Dev B blocked on `/api/generate` until resolved)
2. **Gmail auth** — OAuth2 token setup or fallback to `mailto:` for v1?
3. **Render CLI** — confirm `render deploy --dir` is the correct command for your Render setup

---

## Out of Scope (v1)
- Pioneer/GLiNER (removed)
- DeepSeek prompt enrichment
- Database
- Auth
- Frontend deployment
- Multiple users