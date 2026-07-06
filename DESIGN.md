# Pickfix Overlay Design System

## 1. Atmosphere & Identity

Pickfix feels like a precise development instrument layered over the user's app: compact, inspectable, and quiet until a component is selected. The signature is an editor-grade overlay that uses thin selection outlines, neutral surfaces, and confidence signals to explain what the tool knows without taking over the page.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/page veil | --pf-surface-veil | rgba(15, 23, 42, 0.04) | rgba(2, 6, 23, 0.20) | Optional non-blocking overlay veil |
| Surface/inspector | --pf-surface-inspector | #FFFFFF | #111318 | Inspector panel surface |
| Surface/raised | --pf-surface-raised | #F8FAFC | #191C22 | Fields, code chips, grouped controls |
| Surface/inverse | --pf-surface-inverse | #111827 | #F8FAFC | High contrast callouts |
| Text/primary | --pf-text-primary | #111827 | #F8FAFC | Main panel copy and labels |
| Text/secondary | --pf-text-secondary | #475569 | #CBD5E1 | Metadata and secondary rows |
| Text/muted | --pf-text-muted | #64748B | #94A3B8 | Disabled, low emphasis text |
| Border/default | --pf-border-default | #CBD5E1 | #334155 | Panel, inputs, separators |
| Border/subtle | --pf-border-subtle | #E2E8F0 | #1E293B | Internal dividers |
| Selection outline | --pf-selection-outline | #2563EB | #60A5FA | Hover and selected element outline |
| Selection outline pinned | --pf-selection-pinned | #0F766E | #2DD4BF | Pinned target outline |
| Keyboard focus | --pf-focus-ring | #7C3AED | #A78BFA | Focus-visible ring for controls and targets |
| Confidence/high | --pf-confidence-high | #15803D | #4ADE80 | High-confidence badge and marker |
| Confidence/medium | --pf-confidence-medium | #B45309 | #FBBF24 | Medium-confidence badge and warning marker |
| Confidence/low | --pf-confidence-low | #B91C1C | #F87171 | Low-confidence badge and fallback marker |
| Accent/action | --pf-accent-action | #2563EB | #60A5FA | Primary copy actions |
| Accent/action hover | --pf-accent-action-hover | #1D4ED8 | #93C5FD | Hover state for primary copy actions |

### Rules

- The overlay must support dark and light host pages without assuming the app theme.
- Accent colors are reserved for interactive state, selection, and resolver confidence.
- Selection outlines must remain visible over both bright and dark content; use outline plus subtle box-shadow when contrast is low.
- No decorative gradients, orbs, or large color fields. The overlay is a tool, not a landing page.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Panel title | 15px | 650 | 1.35 | 0 | Inspector panel heading |
| Section label | 12px | 650 | 1.35 | 0 | Field groups and component metadata labels |
| Body | 13px | 450 | 1.45 | 0 | Default panel text |
| Body small | 12px | 450 | 1.4 | 0 | Secondary metadata and helper text |
| Caption | 11px | 600 | 1.3 | 0 | Badges, keyboard hints, compact buttons |
| Code | 12px | 500 | 1.45 | 0 | Source location, command preview, ids |

### Font Stack

- Primary: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- Mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace

### Rules

- Typography stays compact because the panel sits over another application.
- Body text never goes below 12px inside the overlay; labels may use 11px only for badges or keyboard hints.
- Source paths and generated command snippets use the mono stack.
- Text must wrap inside the inspector and composer; no horizontal overflow at 375px viewport width.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a 4px base.

| Token | Value | Usage |
|-------|-------|-------|
| --pf-space-1 | 4px | Icon gap, dense separators |
| --pf-space-2 | 8px | Inline control gap, compact rows |
| --pf-space-3 | 12px | Field padding, row groups |
| --pf-space-4 | 16px | Inspector panel padding |
| --pf-space-5 | 20px | Gap between major panel groups |
| --pf-space-6 | 24px | Panel offset from viewport edge |
| --pf-space-8 | 32px | Maximum group separation |

### Layout

- Inspector panel placement: anchored popover near the selected target with 12px target gap and 8px viewport clamp, choosing the candidate with the least selected-target and nearby-source overlap.
- Panel max height: min(400px, calc(100dvh - 16px)), with internal scrolling for prompt controls when the selected target is near a viewport edge.
- Selection outline offset: 2px outside the target bounds; pinned state uses the same geometry with the pinned color token.
- Prompt composer fields stack vertically and use full available panel width.

### Rules

- Use the spacing scale for every panel, field, badge, and toolbar gap.
- The overlay must not shift host app layout; it is fixed-position and pointer-scoped.
- Do not nest cards inside cards. The panel is one surface with grouped rows.
- Keep controls reachable by keyboard and visible when the host page is scrolled.

## 5. Components

### Inspector panel

- **Structure**: fixed overlay surface with header, selected component summary, source location, confidence row, resolver details, and action area.
- **Variants**: default, pinned target, low-confidence fallback, no-match empty state.
- **Spacing**: panel padding `--pf-space-4`, row gap `--pf-space-3`, dense metadata gap `--pf-space-2`.
- **States**: open, collapsed, loading context, error, empty, pinned, keyboard focused.
- **Accessibility**: labelled region, logical tab order, focus trapped only when modal-like composer controls are active.
- **Motion**: 150ms opacity and transform entrance; no layout animation.

### Selection outline

- **Structure**: fixed-position rectangle aligned to target bounding box, outside the document flow.
- **Variants**: hover candidate, pinned selection, keyboard target, unavailable target.
- **Spacing**: 2px outline offset with 1px or 2px outline thickness depending on contrast.
- **States**: hover, active, pinned, focus, low-confidence fallback.
- **Accessibility**: targetable by keyboard navigation with visible focus affordance.
- **Motion**: 100ms transform and opacity updates; reduced motion disables animated transitions.

### Confidence badge

- **Structure**: compact pill with resolver label and optional source marker.
- **Variants**: high, medium, low.
- **Spacing**: horizontal padding `--pf-space-2`, vertical padding `--pf-space-1`.
- **States**: default, loading, warning, error.
- **Accessibility**: color is paired with text; do not rely on color alone.
- **Motion**: none beyond inherited opacity transitions.

### Prompt composer

- **Structure**: compact one-column controls with optional `Text 수정` above `Comment`, a bottom `Add comment` action for the whole draft, compact numbered comment list with per-row delete controls, one `Create prompt` action, visible generated prompt output below comments, and manual copy fallback.
- **Number markers**: added comments render as small numbered circular markers attached to the clicked target's top-left edge with no inset, and as matching numbered rows inside the composer.
- **Comment deletion**: deleting a saved comment removes its marker, renumbers remaining rows and markers from 1, clears any stale generated output, and keeps draft inputs unchanged.
- **Text changes**: selecting a direct visible text target reveals `Text 수정` above `Comment`, prefilled with the current text. Editing this field does not mutate the DOM and does not create a marker until `Add comment` saves it as a numbered comment.
- **Prompt-first rule**: comments and text replacement notes are copied as prompt text only, and the browser never writes source files.
- **Reset behavior**: changing the pinned selection clears draft comment text, generated output, copy status, and clipboard fallback. Saved numbered comments and their component markers persist across selection changes until Reset or Close clears the session.
- **Selection continuity**: after a comment is added, the composer stays available for another comment on the same target. The anchored popover keeps the selected target highlighted and clamps inside the viewport; its chrome lets page clicks pass through while real inputs and buttons stay interactive.
- **Variants**: generic short prompt and clipboard fallback.
- **Spacing**: group gap `--pf-space-4`, field gap `--pf-space-2`; controls use full panel width without layout shift when text changes.
- **States**: empty, dirty, generating, copied, clipboard denied, error.
- **Accessibility**: each field has a visible label, keyboard focus ring, and deterministic tab order.
- **Motion**: copied confirmation fades in/out using opacity only.

### Toolbar button

- **Structure**: icon or short text button with accessible name.
- **Variants**: primary copy action, secondary reset/close action, floating draggable toggle action.
- **Spacing**: min height 32px, horizontal padding `--pf-space-3`, icon gap `--pf-space-2`.
- **States**: default, hover, active, disabled, loading, focus.
- **Floating behavior**: the Pickfix toggle starts near the viewport edge, can be dragged to another viewport-clamped position, and dragging it must not toggle selection mode.
- **Accessibility**: focus-visible uses `--pf-focus-ring`; disabled controls remain readable.
- **Motion**: 100ms background, border, opacity transitions.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 100ms | ease-out | Selection outline follow, button press |
| Standard | 150ms | ease-out | Inspector panel open, copied feedback |
| Context update | 200ms | ease-in-out | Loading-to-content swap |

### Keyboard

- `Esc` clears the active hover or pinned selection, then closes the panel when no selection remains.
- `Enter` pins the currently keyboard-focused target while selection mode is active.
- `Tab` moves through toolbar actions, inspector rows, and prompt composer fields in document order.
- Focus-visible always uses `--pf-focus-ring` and must be visible over dark and light host content.

### Rules

- Only animate transform and opacity.
- Hover, active, focus, disabled, loading, error, and copied states are required before an overlay component ships.
- Pointer interactions must not block normal app usage unless selection mode is active.
- Respect `prefers-reduced-motion` by removing non-essential transitions.

## 7. Depth & Surface

### Strategy

Pickfix uses mixed depth: tonal shifts for internal grouping, one border for the panel edge, and a restrained shadow only for overlay separation from the host app.

| Level | Token | Light | Dark | Usage |
|-------|-------|-------|------|-------|
| Panel border | --pf-depth-border | 1px solid rgba(15, 23, 42, 0.14) | 1px solid rgba(226, 232, 240, 0.16) | Inspector panel boundary |
| Panel shadow | --pf-depth-shadow | 0 18px 50px rgba(15, 23, 42, 0.18) | 0 18px 50px rgba(0, 0, 0, 0.42) | Overlay separation |
| Field inset | --pf-depth-inset | inset 0 0 0 1px rgba(15, 23, 42, 0.10) | inset 0 0 0 1px rgba(226, 232, 240, 0.12) | Inputs and command previews |

### Rules

- The inspector floats above the app but should not feel like a modal unless clipboard fallback requires focused input.
- Selection UI uses outlines, not filled overlays, so the selected component remains inspectable.
- Internal sections use tonal surface changes before adding borders.
- Shadows never encode state; state is handled by color, outline, text, and badges.
