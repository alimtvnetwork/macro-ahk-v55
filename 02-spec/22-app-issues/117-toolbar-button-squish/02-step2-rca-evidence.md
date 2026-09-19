# Issue 117 — Step 2: RCA Evidence

**Date:** 2026-05-25
**Status:** Root cause **CONFIRMED**. Hypothesis A from Step 1 is correct.

---

## 1. Confirmation: `btnRow` is in `bodyElements`

```
$ rg -n "bodyElements" standalone-scripts/macro-controller/src/ui/

panel-builder.ts:152:  plCtx.bodyElements = [status, infoRow, btnRow, authDiagRow, wsDropSection, toolsSection];
panel-builder.ts:205:  for (const el of plCtx.bodyElements) { el.style.display = 'none'; }   // _restoreMinimizedPanel
panel-layout.ts:414:   for (const el of ctx.bodyElements) { el.style.display = 'none'; }   // toggleMinimize → minimize branch
panel-layout.ts:428:   for (const el of ctx.bodyElements) { el.style.display = ''; }       // toggleMinimize → expand branch
panel-layout.ts:448:   for (const el of ctx.bodyElements) { el.style.display = ''; }       // restorePanel
```

`btnRow` is directly mutated by `el.style.display = '' / 'none'` on every minimize/expand cycle.

## 2. How the inline `display:flex` is set on `btnRow`

`src/ui/panel-controls.ts` L130:
```ts
btnRow.style.cssText = 'display:flex;gap:10px;row-gap:10px;flex-wrap:wrap;'
                     + 'align-items:center;justify-content:center;'
                     + 'padding:8px 10px 10px;width:100%;max-width:100%;'
                     + 'min-width:0;margin:0 auto;box-sizing:border-box;overflow:visible;';
```

`display:flex` lives in the **inline style declaration** (not a CSS rule). It is the *only*
thing that makes `gap`, `flex-wrap`, `align-items`, `justify-content` take effect —
those properties are inert on a `display:block` element.

## 3. The DOM mutation that breaks it

`src/ui/panel-layout.ts` `toggleMinimize`:

```ts
// minimize
for (const el of ctx.bodyElements) {
  el.style.display = 'none';        // ← overwrites inline 'flex' with 'none'
}

// later, expand
for (const el of ctx.bodyElements) {
  el.style.display = '';            // ← REMOVES the display property from inline style
}                                   //   → element falls back to user-agent default
                                    //   → <div> default is 'block', NOT 'flex'
```

DOM spec confirms: setting `element.style.<prop> = ''` removes that property from the
inline style declaration. The original `display:flex` is **gone** — there is no CSS
stylesheet rule providing `display:flex` to bring it back.

## 4. Live consequence on btn-row

| Property               | Before minimize | After expand (current bug) |
|------------------------|-----------------|----------------------------|
| `display`              | `flex`          | `block` (UA default)       |
| `gap` effective?       | YES — 10px between children | NO — gap is ignored on block |
| `flex-wrap` effective? | YES             | NO                         |
| `justify-content`?     | YES — centered  | NO — children left-justified |
| `align-items`?         | YES             | NO                         |
| Per-button `margin:2px 3px` | applied (in addition to gap) | applied (now the ONLY spacing) |

→ Children stack as inline-flex buttons (each `<button>` is `display:inline-flex` per
L139 `btnStyle`), separated only by `margin:2px 3px`. Visually: buttons look
"squished together" — matches the user report exactly.

## 5. Bonus: other affected rows

The same bug applies to `status`, `infoRow`, `authDiagRow`, `wsDropSection`,
`toolsSection` — any of them that rely on inline `display:flex|grid|inline-flex` for
their layout lose it on every minimize→expand cycle. The btn-row is just the most
visible offender because its `gap`+`justify-content:center` makes the regression
obvious.

## 6. Fix shape (Step 3 preview)

Mirror the existing `expandedHeight` stash pattern — snapshot the original `display`
per element on minimize, restore it on expand. Pseudocode:

```ts
// minimize
for (const el of ctx.bodyElements) {
  if (!el.dataset.macroPrevDisplay) {
    el.dataset.macroPrevDisplay = el.style.display || '';
  }
  el.style.display = 'none';
}

// expand
for (const el of ctx.bodyElements) {
  el.style.display = el.dataset.macroPrevDisplay || '';
  delete el.dataset.macroPrevDisplay;
}
```

This is minimal, targeted, has zero visual impact on first paint, and leaves all
other layout code untouched.

## 7. Why the prior fixes (v2.195.0, v2.196.0, v2.239.0, v3.9.3, v3.10.0) didn't fully solve it

Each prior fix piled on **inline style defenses inside `cssText`** (gap, margin,
min-width, max-width, overflow, etc.) — but every one of them lives inside the same
inline `style` declaration whose `display:flex` gets wiped by `toggleMinimize`. The
defenses look correct in DevTools right after construction, but the `display` flip
on every expand silently disables the flex container that made them work. That's
why the bug has resurfaced repeatedly across versions despite multiple "fixes".
