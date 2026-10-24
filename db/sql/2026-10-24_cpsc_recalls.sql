-- CPSC recall catalog + appliance matches (staff confirmation workflow)

CREATE TABLE IF NOT EXISTS cpsc_recalls (
    cpsc_recall_id BIGINT PRIMARY KEY,
    title TEXT NOT NULL,
    recall_date DATE,
    last_publish_date DATE,
    url TEXT,
    hazard TEXT,
    remedy TEXT,
    manufacturer TEXT,
    product_name TEXT,
    model_numbers JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_payload JSONB,
    fetched_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cpsc_recalls_last_publish ON cpsc_recalls (last_publish_date);

CREATE TABLE IF NOT EXISTS cpsc_recall_sync_state (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_publish_date_start DATE,
    bootstrap_completed BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO cpsc_recall_sync_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS client_appliance_recall_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appliance_id UUID NOT NULL REFERENCES client_appliances (id) ON DELETE CASCADE,
    cpsc_recall_id BIGINT NOT NULL REFERENCES cpsc_recalls (cpsc_recall_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    matched_on TEXT NOT NULL,
    match_rule VARCHAR(40) NOT NULL,
    first_seen_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMP WITHOUT TIME ZONE,
    confirmed_by UUID REFERENCES users (id) ON DELETE SET NULL,
    dismissed_at TIMESTAMP WITHOUT TIME ZONE,
    dismissed_by UUID REFERENCES users (id) ON DELETE SET NULL,
    customer_notified_at TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT client_appliance_recall_matches_status_check
        CHECK (status IN ('pending', 'confirmed', 'dismissed')),
    CONSTRAINT client_appliance_recall_matches_unique UNIQUE (appliance_id, cpsc_recall_id)
);

CREATE INDEX IF NOT EXISTS idx_recall_matches_status ON client_appliance_recall_matches (status);
CREATE INDEX IF NOT EXISTS idx_recall_matches_appliance ON client_appliance_recall_matches (appliance_id);
