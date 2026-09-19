# Visual regression constraints

- The aqua (折射玻璃) material is frozen at the restored pre-round code in `dist/workshop-theme-system.js`. Its tokens and the `PMM_FROZEN_VISUAL_BASELINE` CSS must not change without an explicit user request. Shared CSS must not indirectly change its appearance.
- The approved frozen banner exception is the floating group count text rule (`.quick-edit-dropdown .section-header > .section-header__count`): a small blue readability increase, without a badge, weight, layout, or material change.
- Violet uses the same restored baseline. Do not redesign it without an explicit user request.
- Preserve current draft state, authoritative Tavern preset selection, deferred scrolling, drag performance, and runtime cleanup when repairing visuals.
- `scripts/fixtures/workshop-frozen-visuals.json` records the original source hashes. Do not regenerate these hashes to approve an unintended visual change.

- The user additionally authorized only aqua main-interface button tone consistency and group layering corrections. Keep those changes in the `PMM_APPROVED_AQUA_MAIN` block / runtime button helper; reuse existing tokens, leave the original baseline and all banner material rules unchanged. Day/night transition timing may change without redesigning any material.
