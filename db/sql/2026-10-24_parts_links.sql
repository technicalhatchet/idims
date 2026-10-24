INSERT INTO settings (key, value, description, updated_at)
VALUES (
    'parts_links',
    '{"model_search_url_template": "https://www.searspartsdirect.com/search?q={model}", "water_filter_search_url_template": "https://www.searspartsdirect.com/search?q={model}%20water%20filter"}'::jsonb,
    'Customer-facing parts search URL templates ({model} placeholder)',
    NOW()
)
ON CONFLICT (key) DO NOTHING;
