# Developer A — Spec Compliance Review

## Spec Requirements vs Implementation

### 1. Google Places API
| Requirement | Spec | Implementation | Status |
|-------------|------|----------------|--------|
| Text search | GET textsearch/json, get place IDs | `textSearch(query)` → `[{ place_id, name }]` | ✅ |
| Place details | GET details with name, address, phone, website, rating, user_ratings_total, editorial_summary | `getDetails(placeId)` with same fields | ✅ |
| Filter no-website | Keep only where website absent | `if (detail.website) continue` | ✅ |

### 2. Yutori Research API
| Requirement | Spec | Implementation | Status |
|-------------|------|----------------|--------|
| Create task | POST with query (business name, address) | `createTask(businessName, address)` — uses X-API-Key, /v1/research/tasks (doc-correct) | ✅ |
| Poll | Every 3s, timeout 120s | POLL_INTERVAL_MS 3000, POLL_TIMEOUT_MS 120000 | ✅ |
| Parse result | email, style, description | `parseResult()` returns { email, style, description } | ✅ |

### 3. Slug
| Requirement | Spec | Implementation | Status |
|-------------|------|----------------|--------|
| Dev A generates | Lowercase, spaces → hyphens, strip non-alphanumeric | `lib/slug.js` slugify(), applied when place is known (before Yutori) | ✅ |

### 4. Endpoints

| Endpoint | Spec | Implementation | Status |
|----------|------|----------------|--------|
| POST /api/search | Body `{ query }`, return `{ search_id }` immediately; run pipeline in background | Validates query, 400 if missing/empty; returns search_id; runPipeline() in background | ✅ |
| GET /api/search/:search_id/status | status (pending\|processing\|completed\|failed), completed, total | Same shape; 404 if search not found | ✅ |
| GET /api/results/:search_id | Array of enriched businesses | search.businesses (streaming); 404 if not found | ✅ |
| POST /api/businesses/save | (Dev B; Dev A must not call) | Dev A uses store only, does not call this endpoint | ✅ |

### 5. Data — businesses.json
| Requirement | Spec | Implementation | Status |
|-------------|------|----------------|--------|
| Write | Append per business (read → append one → write) | readData('businesses.json'), list.push(business), writeData() | ✅ |
| Schema | id, name, address, phone, email, has_website, google_reviews, google_rating, style, description, slug, status | Same fields written; status initially 'pending'; generate route updates to 'deployed' + live_url | ✅ |

### 6. Pipeline flow
| Requirement | Spec | Implementation | Status |
|-------------|------|----------------|--------|
| Places → filter no-website → Yutori per business | Per business: create task, poll, then append + generate | runOne() per place: slug → createTask → pollTask → append to store → POST /api/generate → push to search.businesses | ✅ |
| Stream results | Cards stream in as each completes | search.businesses updated per business; GET /api/results returns current array | ✅ |

### 7. Cron (cron.js)
| Requirement | Spec | Implementation | Status |
|-------------|------|----------------|--------|
| Dev A owns | Daily 9am, POST /api/search per category | node-cron '0 9 * * *', fetch localhost:3000/api/search | ✅ |
| Categories config | Hardcoded array at top | CATEGORIES array | ✅ |

---

## Testing Coverage (Before Augmentation)

| What | Tested? | Notes |
|------|---------|--------|
| Slug | ✅ | testSlug(): format, trim, non-alphanumeric |
| Google Places textSearch + getDetails | ✅ | When key present |
| Yutori createTask | ✅ | When key present; poll not exercised in isolation |
| POST /api/search → search_id | ✅ | testSearchEndpoints |
| GET status shape | ✅ | status, completed, total |
| GET results array | ✅ | Array check |
| Results shape (one business) | ⚠️ | Only when pipeline returns ≥1; often SKIP (0 no-website) |
| POST /api/search 400 (empty query) | ❌ | Not tested |
| GET status 404 (bad search_id) | ❌ | Not tested |
| GET results 404 (bad search_id) | ❌ | Not tested |
| businesses.json read/write | ❌ | No test that reads data/businesses.json after pipeline and asserts schema |
| Cron | ❌ | Not automated (manual run) |

---

## Gaps Addressed

Validation script will be extended to:

1. **4xx behavior** — Assert POST /api/search returns 400 when query is missing or empty; GET status and GET results return 404 for unknown search_id.
2. **businesses.json** — When a pipeline run produces at least one result, read `data/businesses.json` via store (or fs) and assert at least one object has required schema fields (id, name, slug, has_website, etc.), so read/write and schema are validated.

Cron remains manual (run `node cron.js` and confirm no throw); optional E2E could POST a search and wait for completion then assert file contents.
