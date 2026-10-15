# Responsive and PWA verification

Checked on 13 October 2026 using a local production build and disposable synthetic data. Production data, accounts and device permissions were not changed.

## Fixes in this pass

- Project, employee-directory, project-workspace and notification filter tabs retain their width and scroll horizontally instead of squeezing or overlapping their labels.
- Project search/status controls shrink and wrap appropriately, with accessible labels.
- Jira backlog quick creation stacks its type, title and action on phones. The title input no longer collapses to approximately 24 pixels. Sprint/backlog headers wrap around their counters.
- Install and update notices share safe-area positioning. Update notices take priority over the install banner.
- App content reserves space for visible install/update notices. Chat sizing accounts for both notice heights.
- Login notices use normal page flow, so they cannot cover credentials or the Sign In button. Login and mobile navigation account for device safe areas.
- In a short viewport, resizing brings the focused chat composer into view above mobile navigation. Its unsent draft survives resizing.

## Browser checks

The eight main screens were checked at 320x800, 375x812, 430x932, 667x375 (landscape), 768x1024, 1024x768, 1440x900 and 1920x1080:

| Screen | Result |
| --- | --- |
| Dashboard | No document overflow or undersized checked controls |
| Projects portfolio | Filters and cards fit; tabs scroll within their container |
| Project details | Workspace fits; Kanban scrolls within its container |
| Attendance | Controls and history fit; tables scroll within their container |
| Deduction settings | Settings and simulator fit |
| Employees | Cards and controls fit; department tabs scroll |
| Leaves | Controls fit; request table scrolls within its container |
| Chat | Conversations and active chat fit; long messages wrap |

Login was also checked at these eight viewport sizes. Together with additional role checks, this produced 112 layout checks with no measured document overflow or undersized checked controls. Horizontal table/Kanban scrolling is intentional and is not counted as document overflow.

Team Member, Team Manager, Project Manager and Super Admin views were checked at 320 and 768 pixels for dashboard, attendance, project details, leaves and chat. The main-screen checks used the CEO view.

Project subviews checked at phone width: board, backlog, roadmap, scope, credentials, timeline, resource allocation and time management. The corrected backlog title input measured approximately 261 pixels wide at the 320-pixel viewport.

Dialogs inspected include project creation/editing, issue creation/details, employee creation/editing, password-reset preview, profile settings, account recovery, leave application, new/group conversation, work-hour entry, resource assignment and credential entry. Short landscape checks confirmed that the tested long forms stay within the viewport and provide internal scrolling. Credential-reset forms were inspected without submitting changes.

## Additional responsive audit

A follow-up UI audit used a local development preview with disposable fixtures. Each of the eight main screens also passed at 280x900 and 2560x900, adding 16 layout checks (128 across both passes). No document overflow or undersized checked controls was measured. These checks supplement the production PWA checks below.

- The closed mobile sidebar is now hidden from keyboard focus. Opening it focuses its controls, keeps Tab navigation inside the menu and locks background scrolling. Escape restores focus and scrolling. Resizing to desktop closes the mobile dialog and restores scrolling.
- Range inputs and adjacent checkbox/radio labels have 44-pixel touch heights. Shared touch rules also apply to devices with an additional coarse pointer, such as touchscreen laptops.
- Attendance audit details stack below 400 pixels; long device identifiers and employee names wrap. Its close controls have accessible names. The inspector fits at 280x800 and provides internal scrolling at 667x375.
- Resource allocation, work-hours and credential editors have named close buttons. These editors and the project deletion confirmation were inspected at 280 pixels; long work-hours and credential forms also fit and scroll at 667x375. The deletion confirmation was canceled.
- Company history date-range controls and employee search fit the narrow phone viewport. Deduction sliders and the billable-hours checkbox label measured 44 pixels high.

Additional layout results are saved in `../tmp/responsive-followup-results.json`. All 31 frontend regression tests passed again after these changes, and the final production build was checked without fixture URL overrides.

## Short-screen and enlarged-text follow-up

An additional 24 layout checks passed: the eight main screens at 280x320 and 1024x320, plus the same screens at 375x812 with the root font doubled to 32 pixels. The text-size override was temporary local QA styling and was removed before the final build. These checks bring the accumulated layout checks to 152; hardware-dependent behavior remains subject to the device checks below.

- At 667x320, the previous sidebar navigation had only 32 pixels of height and clipped its links. The menu now has one scrollable body below its persistent logo/Close header. Its navigation, profile action and footer are reachable through scrolling; the scroll region measured 240 pixels high with 877 pixels of content.
- Keyboard traversal reaches the lower profile control, scrolls it into view and cycles back to the brand link. Escape restores focus to the opener and unlocks background scrolling. The close callback is stable across parent renders so it does not unnecessarily reset menu focus.
- Header account actions remain within the phone viewport with enlarged text. Their compact icon buttons preserve 44-pixel touch targets; the clock can shrink without pushing Profile or Sign Out off-screen.
- Sidebar navigation labels wrap beside badges. Project-card deadlines and Edit/Delete/Manage actions wrap, fixing a clipped Manage link found during the text-size check.
- The short-screen measurements include loaded route content and header-action bounds. No document overflow, undersized checked mobile controls or off-screen header actions was measured after the fixes.

Detailed results are in `../tmp/responsive-edge-results.json`. The PWA manifest, safe-area handling and offline/update implementation are retained; the existing PWA regression suite was rerun with the final UI changes.

## PWA checks

- Production HTTP checks passed for the manifest content type, standalone display, root scope, all declared icon URLs, worker content type/scope/cache headers, generated build version and the self-contained offline document.
- A real waiting-update notice appeared after rebuilding the preview. Refresh activated the latest worker and reloaded the app; the notice disappeared after activation.
- A visible login update notice was verified to use relative/page-flow positioning, with no intersection with the Sign In button.
- With the preview server stopped, navigating to the dashboard served the service worker's offline page. After restoring the server, Try again returned to the working dashboard.
- A draft remained intact, and its composer became visible above navigation, when changing from a phone viewport to 667x375.
- Viewport overrides were reset and temporary preview processes were stopped after verification.

## Automated validation

40 frontend tests passed (including attendance freshness, saved-shift, inferred/manual absence and quarantine actions, confirmation identity/version, GPS-distance, authoritative dashboard status and guarded compensation/zero-pay regressions):

```powershell
node --test scripts/attendance.test.mjs scripts/chat.test.mjs scripts/pwa.test.mjs scripts/pwa-updates.test.mjs scripts/pwa-banners.test.mjs
```

Coverage includes the manifest/icon dimensions, Android notification badge, private-data cache exclusions, offline navigation, worker activation, deployment updates without unsolicited form reloads, notification account binding/click handling and install-banner priority/dismissal. Production build and TypeScript validation passed.

## Release and physical-device checks

Complete attendance review finished on 15 October: a failed dashboard showed Retry Dashboard and recovered; employee absence remained visible despite retained check-in evidence, and total/category leave balances used fresh API data. Quarantined current attendance offered no clock action and displayed role-appropriate repair guidance. Synthetic phone-only employee edits omitted unchanged compensation; a 9.5-day balance edit sent only the changed balance with its viewed-value guard. The employee dialog fit 280x800, 375x812 and 667x320 without horizontal overflow or undersized buttons. All requests used disposable local fixtures. The final production build/TypeScript passed and contained no QA URLs. See [complete report](D:/neximet-platform/output/attendance-complete-review-2026-10-15.md).

Attendance follow-up on 14 October: leave, legacy-repair and absence-review dialogs were checked at 280x800, 375x812 and 667x320. Dialog content remains inside the viewport and scrolls when needed. The leave quote showed two working days across Friday–Monday, rejected a multi-date half-day request and showed 0.5 for a single morning session. A failed roster refresh removed the stale override action and showed Unavailable. Prior overnight attendance retained its original working date, shift end and Clock Out action after the active policy changed. Weekday settings were checked at 280 and 768 pixels without document overflow or undersized mobile controls. These checks used synthetic API fixtures, not production records.

The final build uses the project's normal configuration; QA API URLs were only supplied to temporary build processes. No new production environment variables are needed for these layout changes.

This PWA provides a usable offline fallback, rather than offline attendance/leave/project submissions. Those operations require a connection. Native Android/iOS installation, actual keyboard behavior, device push delivery and camera/GPS permissions still need confirmation on physical devices. Browser viewport checks do not replace those hardware checks.
