# Responsive layouts and PWA verification

Verified locally on 12–13 October 2026 with a production Next.js build and synthetic data. No company database or production accounts were used.

## Layout changes

- Notification panels stay within the screen, including 320-pixel phones.
- Dialogs share dynamic viewport limits, scrollable content, and safe-area padding.
- Employee headers and long names, email addresses, and project titles wrap without squeezing controls.
- The team-directory heading can shrink beside its action button at the 640-pixel breakpoint, keeping Add New Employee inside the viewport.
- Grid children can shrink; tables, project tabs, and Kanban columns scroll within their own containers.
- Small-screen and touch controls use 44-pixel targets; text fields use 16-pixel text to avoid iOS focus zoom.
- Action links and mobile navigation also receive 44-pixel targets on phone/tablet layouts. The clock yields header space on screens at or below 340 pixels, and the sidebar cannot exceed the viewport width.
- Populated credential, resource, milestone, and work-log cards allow long content to wrap without squeezing actions. Work-log actions stack on phones, and dialog action rows can wrap.
- The department chart uses horizontal bars so four department labels remain readable on narrow phones; charts avoid resize animations that draw stale bar positions.
- Chat measures the available viewport and bottom navigation height so the composer stays visible. Short landscape and keyboard-sized screens can scroll the page.
- Reduced-motion preferences and device safe areas are respected.

## PWA deployment and updates

Vercel is configured to use `npm run build`. This generates `public/sw-build.js` from `pwa/service-worker.js` with a unique cache version, then builds Next.js. The generated file is ignored by Git and must be included in deployment output. Do not replace the Vercel build command with a direct `next build` invocation.

`public/sw.js` is the stable entry point and imports the generated worker. Both scripts have cache-bypassing response headers, and registration uses `updateViaCache: 'none'` so imported script changes are detected.

An available update displays a Refresh action. It does not automatically reload an open form or chat draft. Updates activated in another app window offer a refresh here as well. The application also checks when connectivity returns, when a window becomes visible, and hourly while visible and online. Closing all app windows still permits normal service-worker activation. Reinstallation is unnecessary for application deployments.

The update notice reserves space in the page and chat workspace, becomes compact on short screens, and hides while a mobile chat input is focused. It returns when typing ends. This keeps the composer available without forcing a refresh or discarding a draft.

The manifest provides standalone installation, scoped launch URLs, appropriately sized app and maskable icons, shortcuts, and Android/iOS metadata. Android notification badges retain the transparent Neximet logo silhouette. Push subscriptions and authenticated account handling retain their existing behavior.

Offline navigation displays a complete offline page. Private account HTML, API data, chat history, mutations, and Next.js RSC responses are not stored by the worker. Attendance, leave requests, project edits, and messages require connectivity; these are not queued as successful offline submissions.

## Verification

| Check | Result |
| --- | --- |
| Production build, including TypeScript | Passed |
| PWA, update lifecycle, notification, and chat helper tests | 23 passed |
| Focused lint on update lifecycle, provider, chat, build script, and update tests | No errors; one existing image-element warning |
| Main pages: dashboard, projects, employees, leaves, deductions, chat, attendance | 56 production checks; no unintended horizontal overflow |
| Main-page viewports | 320×568, 360×800, 390×844, 768×1024, 1024×768, 1440×900, 1920×1080, 844×390 |
| Additional responsive recheck | 84 checks across the same seven pages; no unintended horizontal overflow after fixing the directory toolbar |
| Recheck viewports | 320×568, 414×896, 639×800, 640×800, 767×1024, 768×1024, 1023×768, 1024×768, 1279×900, 1280×900, 2560×1440, 844×390 |
| Final production page review | 112 checks across the seven main pages plus project detail; no unintended overflow or mobile action targets smaller than 44 pixels (allowing pixel rounding) |
| Final production viewports | 280×653, 320×568, 360×800, 390×844, 414×896, 640×800, 768×1024, 1024×768, 1280×900, 1440×900, 1920×1080, 2560×1440, 844×390, 390×360 |
| Other project tabs | 20 final production checks for scope, credentials, milestones, resources, and time management at widths 280, 320, 768, and 1440 |
| Role-dependent UI | Member, project-manager, and super-admin views reviewed; 12 final production dashboard checks at widths 280, 390, 768, and 1440 passed |
| Extended dialogs | 90 local development component checks across 18 dialogs at 280×653, 320×568, 640×800, 844×390, and 390×360; no horizontal overflow or undersized phone/tablet buttons |
| Installation guide | iPhone/iPad guide preview checked at four narrow/short sizes; actual installation requires device validation |
| Final short-screen PWA/chat interaction | At 390×360, focusing the input hides the update notice, removes its reserved space, and leaves the input bottom at 228px above navigation at 278px |
| Populated tables | Synthetic leave requests, attendance history, company roster, and deduction ledger checked; the roster's rightmost action remains reachable through its horizontal scroll container |
| Short-screen interactions | Employee creation action reachable at 320×568, 844×390, and 390×360; focusing the active chat input at 390×360 scrolls it above the bottom navigation |
| Project detail / Kanban | Checked at widths 320, 768, 1024, and 1440 |
| Dialogs | Employee creation/editing, profile, project creation/editing, issue creation/details, leave application, password recovery, and new chat checked on narrow or short viewports |
| Active phone chat | Composer bottom 710px, navigation starts 762px at 390×844 |
| Real service-worker update | Newly generated imported worker reached waiting state; Refresh activated it and removed obsolete app caches |
| Production asset headers | Both worker scripts, manifest, and favicon returned 200 with correct types; both worker scripts bypass caching |
| Actual offline navigation | With the frontend server stopped, an unvisited project URL displayed the cached offline document |

Browser viewport testing does not replace checking installation, keyboard behavior, safe-area insets, and system notification presentation on physical Android/iOS devices. Notification permission was not granted or changed during this review; synthetic fixtures intentionally leave Web Push unconfigured.

The final production build passed TypeScript, and focused lint passed with one existing Next.js image-element warning. A real update activated the final generated worker and removed all obsolete app caches. Its offline document subsequently loaded with the frontend server stopped and stayed within a 390-pixel viewport. Camera/GPS permission prompts and physical keyboard behavior were not exercised.

## Repeat the checks

```powershell
npm run build
node --test scripts/pwa.test.mjs scripts/pwa-updates.test.mjs scripts/chat.test.mjs
```

For local visual QA, run `node scripts/responsive-fixture-api.mjs` and serve the frontend on localhost ports 3001–3003 with the public API configured to `http://localhost:4000/api`. The fixture API binds only to localhost, returns synthetic data, and rejects operations that would change records. Use `qa@example.test` for the CEO fixture or `member@example.test`, `manager@example.test`, and `admin@example.test` for role previews; any synthetic password works. Use a fresh development origin when a production service worker previously controlled another local port.

Do not expose the fixture API publicly or deploy it as the backend. The temporary PWA diagnostics page used for verification has been removed.
