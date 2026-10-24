# Wave 2 settings UI — 375px screenshots

Merged in [PR #76](https://github.com/technicalhatchet/idims/pull/76).

| File | Content |
|------|---------|
| `recall-nav-badge-375.png` | Recall review nav item with pending count badge |
| `parts-links-panel-375.png` | Settings → Client Portal → Parts links |
| `appliance-lifespans-panel-375.png` | Settings → Client Portal → Appliance lifespans |

Regenerate (optional):

```bash
cd docs/wave2-settings-screenshots
npm install playwright
npx playwright install chromium
node capture.mjs
```

Live app: Settings → **Client Portal** tab, or `/dev/wave2-settings-preview` (admin/manager, flags on).
