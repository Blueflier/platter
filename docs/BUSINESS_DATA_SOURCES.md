# Business data: Google vs Yutori

How each business field is filled and how Google and Yutori are merged.

| Field | Source | Merge rule |
|-------|--------|------------|
| **name** | Google | Place name only (Google). |
| **address** | Google | `formatted_address` only. Yutori does not overwrite. |
| **phone** | Google, Yutori | **Google first.** If Google has no phone, use Yutori-parsed phone. `finalPhone = place.phone \|\| parsed.phone` |
| **email** | Yutori | Google has no email; Yutori only. |
| **business_hours** | Google, Yutori | **Google first.** If Google has no `opening_hours`, use Yutori-parsed hours. `finalBusinessHours = place.opening_hours \|\| parsed.business_hours` |
| **description** | Yutori, Google | Yutori vibe/summary preferred; fallback `place.editorial_summary` if Yutori fails. |
| **style** | Yutori | Yutori only. |
| **google_reviews** | Google | `user_ratings_total`. |
| **google_rating** | Google | `rating`. |
| **social_media_links** | Yutori | Yutori only (array of URLs; Facebook, Instagram, Yelp, etc.). |

So: **phone** and **business_hours** can be updated from either layer (Google first, Yutori as supplement). **Address** is Google-only. **social_media_links** is Yutori-only. All other fields have a single source or fallback as above.

---

## Yutori testing — what’s covered and what’s optional

**Done:**
- Test script uses **no-website** Google places only (production-like).
- One full run: Google → Yutori → parsed output (email, style, description, phone, business_hours, social_media_links).
- HTML stripped; data stored and forwarded as plain text.
- Field merge (phone, business_hours) and sources documented above.

**Optional next steps:**
- **Repeatability:** Run `node scripts/test-yutori-layer.js` multiple times (or `--trials=2`) to confirm the same query shape yields results consistently.
- **Validation script:** Add a check in `validate-dev-a.js` that when Yutori returns, `social_media_links` is an array and parsed fields have no HTML.
- **E2E:** Run full pipeline (POST /api/search with a query that returns no-website places) and assert at least one business in `businesses.json` has `business_hours` and/or `social_media_links` when Yutori returns them.
