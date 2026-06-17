# Icon & Type Review - 2026-06-18

Purpose: normalize icon usage and font sizing without changing Claude's product architecture or core flows. This pass keeps the existing Phosphor-based icon system, Kopay-style type scale, orange/neutral visual language, and current feature behavior.

## Method

- Read the shared icon wrapper in `components/icons.tsx`, semantic typography classes in `styles/components.css`, and visible hotspots across chat, study processing, admin dashboards, flashcards, onboarding/profile, and footer surfaces.
- Static scan targets:
  - emoji / pictographic characters in UI source
  - raw inline SVGs outside the shared icon/asset boundary
  - arbitrary icon sizing such as `text-[18px]`
  - body copy that dropped to `text-xs` in user-facing status messages
- Applied the React best-practices checklist after editing multiple TSX files.

## Findings

### P1 - Chat Text Scale Felt Larger Than The App

- Status: fixed in this pass.
- Evidence: chat bubbles did not set a message-body scale, so Markdown body text inherited the app base `16px`. Markdown headings could render as `24px/20px/18px` inside narrow bubbles.
- Fix: `MarkdownRenderer` now supports `variant="compact"`, and `ChatBubble` uses it with `text-sm` body rhythm. Default Markdown rendering for overview summaries and study tips remains unchanged.
- Guardrail: `ChatInput` keeps `text-base` because shrinking textarea text below 16px can trigger mobile browser zoom and hurt input usability.

### P1 - Image-Content PDF Processing Copy Was Too Small

- Status: fixed in this pass.
- Evidence: the queued large-document overlay used `text-sm` title and `text-xs text-ink-400` body for a critical state message.
- Fix: the title now uses `text-h3`, the body uses `text-body-sm`, and the copy container is slightly wider. OCR state, polling, retry, and limits were not changed.

### P2 - Emoji And Raw Symbol Icons In UI Controls

- Status: fixed in this pass for UI-icon usage.
- Evidence: progress/dashboard/admin/flashcard/chat status surfaces mixed emoji, raw check/cross characters, and an inline send SVG with the Phosphor icon system.
- Fixes:
  - Added `SendIcon` to the Phosphor wrapper and removed the chat input inline SVG.
  - Replaced chat mode/scope status emoji with mascot/document/chat icons.
  - Replaced admin capacity category emoji and action hint symbols with mapped Phosphor icons.
  - Replaced progress empty-state emoji, processing-step check mark, wrong-answer check/cross, flashcard requeue emoji, quiz loading emoji, legal footer emoji, and admin table emoji with icons.
  - Recommendation questions now strip a leading generated emoji only when present and render a stable icon by question type, avoiding the old first-word-as-icon edge case.

### P2 - Arbitrary Icon Sizing

- Status: fixed where found.
- Evidence: interaction tab icons used `text-[18px]`.
- Fix: tab icons now use the existing `text-lg` token.

### P3 - Dense Dashboard Micro Type

- Status: intentionally left alone.
- Evidence: admin charts, capacity rows, table metadata, badges, and file-list metadata use `10px-12px` styles.
- Decision: these are dense operational labels, timestamps, badges, and counters rather than primary reading copy. Bulk-upscaling them would reduce information density and change dashboard hierarchy. Revisit screen-by-screen only when doing a dashboard-specific visual comparison.

## Remaining Intentional Exceptions

- `CleverMonkeyIcon`, `ExitedMonkeyIcon`, and panel toggle SVGs remain in `components/icons.tsx` because they are brand/layout assets, not generic icons.
- `components/Doodles.tsx` remains custom SVG decoration for the landing visual language.
- Provider/status badges and chart ticks remain micro text by design.

## Current Decision

The app should now avoid emoji as UI icons, use the shared icon wrapper for controls/status, and reserve 10-12px text for dense metadata. User-facing status copy should stay at `text-body-sm` or higher unless it is clearly secondary metadata.
