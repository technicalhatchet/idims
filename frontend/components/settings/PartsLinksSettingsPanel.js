import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../utils/api-client';
import { upsertAppSetting } from '../../utils/upsertAppSetting';
import { useFeature } from '../../context/FeatureFlagsContext';
import { useOfficeStaff } from '../../hooks/useOfficeStaff';

const SAMPLE_MODEL = 'WRT311FZDW';

const DEFAULTS = {
  model_search_url_template: 'https://www.searspartsdirect.com/search?q={model}',
  water_filter_search_url_template:
    'https://www.searspartsdirect.com/search?q={model}%20water%20filter',
};

function validateTemplate(url, label) {
  const v = (url || '').trim();
  if (!v) return `${label} is required`;
  if (!v.includes('{model}')) return `${label} must include {model}`;
  if (!v.toLowerCase().startsWith('https://')) return `${label} must start with https://`;
  return null;
}

function buildTestUrl(template) {
  return template.replace(/\{model\}/g, encodeURIComponent(SAMPLE_MODEL));
}

export default function PartsLinksSettingsPanel() {
  const flagOn = useFeature('parts_links');
  const isOffice = useOfficeStaff();
  const [partsUrl, setPartsUrl] = useState(DEFAULTS.model_search_url_template);
  const [filterUrl, setFilterUrl] = useState(DEFAULTS.water_filter_search_url_template);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!flagOn || !isOffice) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await apiClient('/api/settings');
        const raw = data?.settings?.parts_links;
        if (raw && typeof raw === 'object') {
          setPartsUrl(raw.model_search_url_template || DEFAULTS.model_search_url_template);
          setFilterUrl(
            raw.water_filter_search_url_template || DEFAULTS.water_filter_search_url_template,
          );
        }
      } catch {
        toast.error('Failed to load parts links');
      } finally {
        setLoading(false);
      }
    })();
  }, [flagOn, isOffice]);

  if (!flagOn || !isOffice) return null;

  const runValidation = () => {
    const next = {
      parts: validateTemplate(partsUrl, 'Parts search link'),
      filter: validateTemplate(filterUrl, 'Water filter search link'),
    };
    setErrors({ parts: next.parts, filter: next.filter });
    return !next.parts && !next.filter;
  };

  const save = async () => {
    if (!runValidation()) return;
    setSaving(true);
    try {
      await upsertAppSetting({
        key: 'parts_links',
        value: {
          model_search_url_template: partsUrl.trim(),
          water_filter_search_url_template: filterUrl.trim(),
        },
        description: 'Customer-facing parts search URL templates ({model} placeholder)',
      });
      toast.success('Parts links saved');
    } catch (err) {
      toast.error(err?.message || 'Failed to save parts links');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setPartsUrl(DEFAULTS.model_search_url_template);
    setFilterUrl(DEFAULTS.water_filter_search_url_template);
    setErrors({});
  };

  const fieldClass =
    'w-full rounded-lg px-3 py-2 text-sm text-white bg-black/30 border border-white/10 focus:border-cyan-500/50 focus:outline-none';

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading parts links…</p>;
  }

  return (
    <div
      className="space-y-4"
      style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem' }}
      data-settings-panel="parts-links"
    >
      <h3 className="text-white font-semibold">Parts links</h3>
      <p className="text-gray-500 text-xs m-0">
        URL templates for customer appliance pages. Use <code className="text-gray-400">{`{model}`}</code>{' '}
        where the model number belongs.
      </p>

      <div className="space-y-2">
        <label className="block text-sm text-gray-300">Parts search link</label>
        <input
          type="url"
          className={fieldClass}
          value={partsUrl}
          onChange={(e) => {
            setPartsUrl(e.target.value);
            setErrors((prev) => ({ ...prev, parts: null }));
          }}
        />
        {errors.parts && <p className="text-red-400 text-xs m-0">{errors.parts}</p>}
        <button
          type="button"
          className="text-xs text-cyan-400 hover:text-cyan-300"
          onClick={() => window.open(buildTestUrl(partsUrl), '_blank', 'noopener,noreferrer')}
        >
          Test with {SAMPLE_MODEL}
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-300">Water filter search link</label>
        <input
          type="url"
          className={fieldClass}
          value={filterUrl}
          onChange={(e) => {
            setFilterUrl(e.target.value);
            setErrors((prev) => ({ ...prev, filter: null }));
          }}
        />
        {errors.filter && <p className="text-red-400 text-xs m-0">{errors.filter}</p>}
        <button
          type="button"
          className="text-xs text-cyan-400 hover:text-cyan-300"
          onClick={() => window.open(buildTestUrl(filterUrl), '_blank', 'noopener,noreferrer')}
        >
          Test with {SAMPLE_MODEL}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50"
          style={{
            background: 'rgba(34, 211, 238, 0.15)',
            color: '#22D3EE',
            border: '1px solid rgba(34, 211, 238, 0.3)',
          }}
        >
          {saving ? 'Saving…' : 'Save parts links'}
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-300 border border-white/10 hover:bg-white/5"
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}
