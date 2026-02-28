# Platter
### We saw you didn't have a website. So we served you one.

**We find local businesses that don't have a website — and build one for them.**

Lots of small businesses (nail salons, cafés, plumbers, etc.) still have no web presence. Platter finds them, creates a simple landing page for each, and deploys it live. You get a list of ready-to-contact leads: each card shows the new site URL and a pre-written email you can copy and send to the business owner.

**What you do:** Type a search like "nail salons in Oakland" or "cafés in Berkeley." The app finds businesses without websites in that area, researches each one, generates a site, and deploys it. Cards appear with the live link and an outreach email. You copy the email (or call if no email was found) and use "Save for Later" to bookmark leads you want to follow up on.

**Why it matters:** It turns "find businesses that need a website" and "build them one" into one flow. No manual searching, no building from scratch — you go from a search to a list of live sites and ready-to-send outreach.

---

## Flow (user perspective)

```
You type a search
    (e.g. "nail salons in Oakland")
            │
            ▼
   Find businesses in that area, keep only those with no website
   → Google Places API
            │
            ▼
   For each business: look up contact info, hours, description
   → Yutori Research API
            │
            ▼
   Generate a one-page landing site
   → Pioneer (AI)
            │
            ▼
   Deploy the site live
   → Render
            │
            ▼
   Cards appear: business name, address, phone,
   live site URL, and a pre-written email
            │
            ▼
   You copy the email (or call), send it to
   the owner, and optionally Save for Later
```

**Tools by stage:** Google Places (discovery + filter) → Yutori (research) → Pioneer (generate HTML) → Render (deploy). Data is stored in local JSON; no database.
