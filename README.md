# 360Learning — Skills Ontology Setup Tool

A single-page, static HTML tool to automate building a full **Skills ontology**
(Libraries → Skills → Jobs → Job‑Skill mapping) on a 360Learning demo account,
using the [360Learning API v2](https://360learning.readme.io/docs/introduction).

Everything runs **client-side in your browser** — it calls the 360Learning API
directly with the credentials you type in. Nothing is stored or sent anywhere
else. There is no backend/server component.

---

## 1. Host it on GitHub Pages

1. Create a new GitHub repo (e.g. `360learning-skills-setup`), public or private.
2. Add `index.html` (this file) to the repo root.
3. Go to **Settings → Pages**, set **Source** to `Deploy from a branch`,
   branch `main`, folder `/ (root)`. Save.
4. GitHub gives you a URL like `https://<your-username>.github.io/360learning-skills-setup/`.
   Open it — that's your tool.

> No build step, no dependencies, no `npm install`. It's one HTML file.

---

## 2. Get your API credentials on the demo account

Only **platform admins/owners** can create API v2 credentials
(see [Step 1: Obtain API v2 credentials](https://360learning.readme.io/docs/step-1-get-your-api-credentials)):

1. Log in to the demo account at `app.360learning.com` (or `app.us.360learning.com`).
2. Sidebar → hover the platform group → **Settings** (gear icon) → **API v2**.
3. **+ Add API Credentials**.
4. Give it a descriptive label (e.g. `Skills Ontology Setup Tool`).
5. Under **Permissions**, enable at least:
   - `skillsLibraries:bulk`
   - `skills:bulk`
   - `skillsJobs:bulk`
   - `skillsJobSkills:bulk` (only needed for the optional Job‑Skill mapping step)
   - `skills:read`
   - `bulkOperations:read`
6. Save → **copy the Client Secret immediately** (shown once) → copy the Client ID.

---

## 3. Use the tool

The interface walks through 5 steps:

### Step 1 — Credentials
Paste the **Client ID** and **Client Secret**, pick the environment
(Production EU `app.360learning.com`, Production US `app.us.360learning.com`,
or a custom/staging URL), and click **Get access token**.

Under the hood this calls:
```
POST {baseUrl}/api/v2/oauth2/token
{
  "grant_type": "client_credentials",
  "client_id": "...",
  "client_secret": "..."
}
```
Tokens expire after 1 hour — the tool re-requests one automatically if it expires
mid-session.

### Step 2 — Ontology data (upload CSV or XLSX)
For each ontology level, click **⬇ Download CSV template** to get a starter
file with the right column headers, fill it in (in Excel/Sheets or a plain
CSV editor), then upload it with the file picker. The tool parses it
client-side (using [SheetJS](https://sheetjs.com/), loaded from a CDN — no
files ever leave your browser except the parsed data you choose to send to
360Learning in Step 3) and shows you the resulting JSON so you can
double-check or hand-edit it before running.

Alternatively, click **Load sample demo ontology** to skip straight to a
ready-made example.

| Level | Required columns | Notes |
|---|---|---|
| **Libraries** | `externalId`, `name` | `description`, `status` (`draft`\|`published`) optional |
| **Skills** | `externalId`, `name`, `parentExternalIds` | `parentExternalIds` = one or more library/skill `externalId`s in the same cell, separated by `;` (or `,`) |
| **Jobs** | `externalId`, `name` | `description`, `parentExternalId` (for job hierarchy) optional |
| **Job‑Skills** (optional, 2nd pass) | `jobId`, `skillId` | These must be 360Learning's **internal** IDs — see the note below |

Both `.csv` and `.xlsx`/`.xls` are accepted; only the first sheet of a
workbook is read.

Every Library/Skill/Job row carries an `externalId` you choose. Re-running
the tool with the same `externalId`s is safe — the API **upserts** (creates
new, or replaces existing) rather than duplicating.

### Step 3 — Run
Click **Run setup**. The tool calls, in order:

| Ontology level | Endpoint | Scope |
|---|---|---|
| Libraries | `PUT /api/v2/bulk/skills/libraries` | `skillsLibraries:bulk` |
| Skills | `PUT /api/v2/bulk/skills` | `skills:bulk` |
| Jobs | `PUT /api/v2/bulk/skills/jobs` | `skillsJobs:bulk` |
| Job‑Skills (optional) | `PUT /api/v2/bulk/skills/jobs-skills` | `skillsJobSkills:bulk` |

Each of these is an **async bulk operation**: the API responds `202 Accepted`
with a `Location` header pointing at `/api/v2/bulk/operations/{id}`. The tool
polls that URL every 2 seconds until the operation reports completion, and
logs progress live.

### Step 4 — Verify
- **List all skills** — confirms what actually landed, and shows the internal
  `_id` for each skill (needed for the Job‑Skills step, since that endpoint
  requires internal IDs, not your `externalId`s).
- **List all bulk operations** — shows recent operation statuses/history.

### Job ↔ Skill mapping (optional, two-pass)
`PUT /api/v2/bulk/skills/jobs-skills` needs 360Learning's **internal**
`jobId`/`skillId`, not your `externalId`s. Workflow:
1. Run Step 3 for Libraries/Skills/Jobs first.
2. Use Step 4 to list skills (and similarly inspect jobs) and copy the internal
   IDs you need.
3. Paste `{ "jobId": "...", "skillId": "..." }` pairs into the "Job ↔ Skill
   mapping" box in Step 2, check "Replace Job‑Skills" in Step 3, and run again.

---

## 4. If requests are blocked (CORS)

360Learning's API is designed for server-to-server integrations. If your
browser blocks calls with a CORS error, this static page can't bypass that.
Two options:
- Ask your CSP/360Learning support whether your origin can be allow-listed for
  browser calls.
- Copy the request bodies from the on-screen log and run the same calls from a
  small server-side script (Node.js/Python) or Postman/curl instead — the
  payloads and endpoints logged by this tool are copy-paste ready.

---

## 5. References

- [360Learning API v2 docs](https://360learning.readme.io/docs/introduction)
- [Step 1: Obtain API v2 credentials](https://360learning.readme.io/docs/step-1-get-your-api-credentials)
- [Step 2: Get an access token](https://360learning.readme.io/docs/step-2-create-an-access-token)
- [Scopes and permissions](https://360learning.readme.io/docs/oauth-scopes)
- [Bulk operations guide](https://360learning.readme.io/docs/bulk-operations-1)
- [Upsert libraries](https://360learning.readme.io/reference/v2bulkskillsupsertlibrariescontroller_upsertlibraries)
- [Upsert skills](https://360learning.readme.io/reference/v2bulkskillsupsertskillscontroller_upsertskills)
- [Upsert jobs](https://360learning.readme.io/reference/v2bulkskillsupsertjobscontroller_upsertjobs)
- [Replace jobs skills](https://360learning.readme.io/reference/v2bulkskillsreplacejobsskillscontroller_replacejobsskills)
- [List all skills](https://360learning.readme.io/reference/v2skillsgetskillscontroller_getskills)
- [Support Center — Skills API search](https://support.360learning.com/hc/en-us/search?utf8=%E2%9C%93&query=skills+api)

## Security notes

- Client Secret is only shown once at creation time in the 360Learning admin
  UI — store it in a password manager.
- This tool does not persist credentials (no `localStorage`) — refresh the
  page and you'll need to re-enter them.
- Prefer creating a **dedicated** API credential for this tool (not one shared
  with other integrations) so it's easy to revoke.
