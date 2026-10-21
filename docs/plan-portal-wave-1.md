# Portal Wave 1

Branch: `feature/portal-wave-1` — one commit per feature (A–D). SQL in `db/sql/` + `_undo`; run all four on test DB before smoke.

**Hard rule:** no changes to diagnostic discount, repair credit, tier pricing, or WO pricing math.

## A. Estimate approval

- SQL: `2026-10-22_portal_wave_1_estimate_approval.sql`
- API: `GET /api/portal/work-orders/{id}/estimate-approval`, `POST .../approve`, `POST .../decline` (preview blocked like payments)
- Staff: `estimate_approval` on `GET /api/work-orders/{id}`
- Smoke: WO in `pending_estimate_approval` with valid estimate → approve/decline; TechDeck badge; declined → approve allowed; approved → decline blocked

## B. Review requests

- SQL: `2026-10-22_portal_wave_1_review_requests.sql` (`work_orders.review_requested_at`)
- Settings key `portal_reviews`: `enabled`, `google_review_url`, `delay_hours` (reserved until background jobs)
- Send via `BackgroundTasks` immediately after payment commit (no Celery)
- Staff: `POST /api/work-orders/{id}/send-review-request`

## C. Customer photos / video

- SQL: `2026-10-22_portal_wave_1_customer_photos.sql` (`work_order_photos.source`)
- Portal: `POST/GET /api/portal/work-orders/{id}/photos` — 6 files, 25MB, images + mp4/mov; EXIF strip on images only
- Copy: “Add photos or a short video (about 15 seconds)”

## D. Property export

- `GET /api/portal/appliances/export.csv`, `repairs-export.csv`, `export-print` (property filter)

## Tests

```bash
pytest backend/tests/test_portal_estimate_approval.py \
  backend/tests/test_portal_review_requests.py \
  backend/tests/test_portal_customer_photos.py \
  backend/tests/test_portal_property_export.py
```
