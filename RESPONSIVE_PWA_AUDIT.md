# Neximet Portal responsive and PWA audit

Audit dates: 10–11 October 2026 (Asia/Karachi).
Deployment: https://neximet-portal.vercel.app/

## Verdict

The deployed site is largely responsive, but it does not pass an unqualified “all screens / fully verified PWA” assessment. Narrow-screen navigation and short-screen dialogs have defects. PWA assets are present, but service-worker lifecycle and offline behavior need correction. Fixes in this workspace have **not been deployed**.

## Coverage

Authenticated live testing used the supplied Project Manager account. No projects, issues, attendance records, leave applications, profile changes, or recovery requests were submitted.

Twelve CSS viewport sizes were measured on each of seven authenticated views (84 route/viewport combinations):

| Class | Sizes (width × height) |
| --- | --- |
| Phones | 320×568, 375×667, 390×844, 430×932 |
| Small/tablet widths | 640×800, 768×1024, 820×1180 |
| Desktop breakpoints | 1024×768, 1280×800, 1440×900, 1920×1080 |
| Phone landscape | 844×390 |

Measurements covered document/main widths and principal controls outside the viewport, excluding intentionally scrollable tables and boards. Screenshots supplemented the measurements; this is not a guarantee for every text length, browser, role, or device.

| Live view | Result |
| --- | --- |
| Dashboard | Main content and checked controls fit all twelve sizes |
| Projects portfolio | Main content and checked controls fit all twelve sizes |
| Project Jira board | Roadmap sub-view button clipped at 320px |
| Leaves | Page fits; application dialog fails landscape height |
| Attendance | Main content fits; wide history table scrolls within its container |
| Team directory | Main content and checked controls fit all twelve sizes |
| Deduction rules | Main content fits; wide ledger scrolls within its container |

Additional checks: 320px login, mobile drawer navigation, issue creation dialog (opened and canceled), profile dialog (opened and canceled), deployed manifest/service-worker/icon HTTP responses, and source review of installation, offline, modal, and safe-area behavior.

## Findings and local fixes

| Finding | Evidence | Workspace change |
| --- | --- | --- |
| Jira sub-view clipped on smallest phone | At 320px, main width approximately 314px; Roadmap right edge approximately 338px | Sub-view switcher now wraps |
| Leave dialog controls unreachable in landscape | At 844×390, dialog about 495px tall, header above viewport, submit button bottom about 411px; no dialog scroll container | Dialog now has a dynamic-viewport height limit and internal scrolling; date fields stack on phones |
| Profile identity crowded on 320px | Email and role compete in an unwrapped row | Identity row wraps and long text can break |
| Other recovery/install dialogs lack short-height containment | Source inspection | Height limits and internal scrolling added to password recovery, admin reset, and iOS install dialogs |
| Small mobile form text and password touch target | Login inputs 12px; visibility button 16×16px on deployed page | Mobile text fields use 16px; login visibility target is at least 44×44px; labels associated with fields |
| Incomplete safe-area treatment | Bottom nav handles bottom inset; header/sidebar/main do not consistently apply insets | Header/main/sidebar use safe-area offsets; sidebar uses dynamic viewport height |
| Tablet install banner overlaps bottom navigation | Banner switches to bottom 24px at 640px while navigation remains visible until 1024px | Banner stays above bottom navigation until desktop breakpoint and wraps on narrow screens |
| Registration can miss page load | Production registration is inside a load listener added by a React effect | Register directly after hydration with updateViaCache disabled; do not cache development builds |
| Offline navigation can serve incomplete/stale application HTML | Deployed worker precaches route HTML but does not guarantee their JS dependencies; fallback prefers cached root | New self-contained offline document; account HTML and RSC/API data are not cached |
| Worker cleanup/cache failures are unsafe or unreliable | Deletes every other origin cache; static miss may resolve undefined; cache writes not attached to event lifetime | Cleanup limited to Neximet caches; valid error responses; writes awaited through waitUntil; exact origin comparison |
| Offline capability overstated | Banner says offline sync; no queue/background sync implementation | Copy states that submissions require internet; no offline submission feature claimed |
| Install prompt reused after dismissal | Deferred prompt only cleared on acceptance | Consume prompt after either outcome; appinstalled confirms success |
| Duplicate manifest/Apple metadata | Multiple manifest links observed in live DOM | Use Next metadata as the single source |

The new worker deliberately waits for existing sessions to close before activation. Existing installations may need all portal tabs/app windows closed and reopened after deployment. Full offline business operations are not implemented or claimed.

## PWA checks

Live HTTPS endpoints returned HTTP 200:

| Asset | Observed content type |
| --- | --- |
| /manifest.webmanifest | application/manifest+json; charset=utf-8 |
| /sw.js | application/javascript; charset=utf-8 |
| /icons/icon-192x192.png | image/png |
| /icons/icon-512x512.png | image/png |
| /icons/maskable-icon-512x512.png | image/png |
| /apple-touch-icon.png | image/png |

The deployed worker has no-cache/no-store headers. Manifest includes name, short name, id, scope, standalone display, start URL, and normal/maskable icons. All declared local PNG dimensions match their manifest sizes.

Validation completed:

- Production `npm run build`: compilation, TypeScript, and static generation passed.
- `node --test scripts/pwa.test.mjs`: nine checks passed, covering manifest/icon dimensions, offline fallback, failed installation, scoped cache cleanup, API/RSC bypass, private HTML exclusion, asset misses, cache-write lifetime/quota errors, and fallback without cache.
- Focused ESLint for PWA components, service worker, and QA scripts: zero errors; two existing img optimization warnings.
- `git diff --check`: passed.
- Local production build with synthetic API data: project board main width equals scroll width at 320, 375, 390, 430, 640, 768, 820, 1024, 1280, 1440, and 1920px. Roadmap opens successfully at 320px.
- Local landscape leave dialog at 844×390: top 16px, bottom approximately 374px, internal scroll height 495px within a 357px client area; footer controls reachable.
- Real browser fallback check: stopped the local Next.js server and reloaded the project URL. The installed local worker returned the self-contained offline document, with no horizontal overflow at 320px. This confirms local worker registration/control and navigation fallback for this browser.

The automated service-worker checks use a controlled Node VM with mocked fetch/cache events. The separate browser test simulates server unavailability; it does not prove OS-level installation or real airplane-mode behavior. Browser automation here does not expose a network-offline toggle or service-worker inspection API.

## Remaining verification before release sign-off

- Deploy changes, then repeat affected layouts against the deployed build.
- Android Chrome: install, standalone launch, cold offline launch, reconnect, update from the previous worker.
- iPhone/iPad Safari: Add to Home Screen, standalone launch, notched portrait/landscape, on-screen keyboard, and text zoom.
- Real camera/GPS permissions and attendance flow, using an explicitly approved disposable test workflow.
- CEO/Super Admin screens, notifications, and admin-only forms with appropriate test accounts.
- Other project tabs/modals and long-content edge cases. This audit covered the Jira board and issue form, not every project operation.

## Separate security finding

`src/components/auth/ForgotPasswordModal.tsx` exposes a default CEO recovery key. `../backend/src/controllers/authController.js` accepts that same hardcoded fallback when `CEO_MASTER_KEY` is unset. This could allow CEO account takeover if the fallback is active. Production environment configuration was not inspected and no reset was attempted. Remove the client-side key disclosure and hardcoded backend fallback, and require a properly secured recovery flow before considering the portal production-ready. This authentication change was not included in the responsive/PWA edits.
