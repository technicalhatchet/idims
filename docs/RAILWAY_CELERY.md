# Railway Celery worker + beat

## Services

Create two Railway services from the same backend image/repo (separate from the API).

| Service | Start command |
|---------|----------------|
| **worker** | `celery -A app.background.worker worker --loglevel=info --concurrency=2` |
| **beat** | `celery -A app.background.worker beat --loglevel=info` |

### Required env (worker + beat)

- `REDIS_URL` — broker/backend URL (same as API if shared). **Worker/beat fail at startup if missing.**
- Same database and app secrets as the API (`DATABASE_URL`, email keys, etc.).

### Launch flags

Leave `worker_feature_flags` empty or all `enabled: false` in Settings → Notifications until you smoke-test each job. The API heartbeat `POST /api/push/process-reminders` can stay enabled for deploy reminders until you turn on `deploy_reminders` on the worker.

## One-time Redis queue purge (before first worker)

Clears stale Celery messages from a previous broken deployment. **Do not run on every deploy.**

### Option A — Railway CLI + redis-cli

1. Install [Railway CLI](https://docs.railway.app/develop/cli) and log in.
2. Link the project and open a shell on the Redis service or use a one-off:

```bash
railway link
railway run redis-cli -u "$REDIS_URL" FLUSHDB
```

Use `FLUSHALL` only if this Redis instance is dedicated solely to Celery and has no other data you need.

### Option B — One-off Python (from backend root)

```bash
railway run python -c "import os; from redis import Redis; Redis.from_url(os.environ['REDIS_URL']).flushdb(); print('flushed')"
```

3. Start **beat**, then **worker**, after the flush.

## Beat schedule (current)

| Interval | Task | Worker flag |
|----------|------|-------------|
| 5 min | `process_scheduled_outreach_tick` (reviews + appointment emails) | `delayed_review_requests`, `appointment_reminders` |
| 60 s | `process_deploy_reminders` | `deploy_reminders` |
| :00/:15/:30/:45 | `send_morning_schedule_summaries` | `morning_summaries` |
| :00/:15/:30/:45 | `run_narrowing_batch` | `portal_narrowing_batch` |
| */15 | `process_scheduling_deadlines` | `portal_scheduling_deadlines` |

Unscheduled (code kept): `check_overdue_invoices`, payment reminders, reports, `perform_db_maintenance`, legacy `send_appointment_reminders`.

## SQL migration

Apply before enabling customer outreach columns in prod:

- `db/sql/2026-10-23_customer_outreach_and_worker_columns.sql`
- Undo: `db/sql/2026-10-23_customer_outreach_and_worker_columns_undo.sql`
