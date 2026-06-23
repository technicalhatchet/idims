import { useState, useEffect } from 'react';
import TechDashboardLayout from '../components/layouts/TechDashboardLayout';
import { useUIPreferences } from '../context/UIPreferencesContext';
import { apiClient } from '../utils/api-client';
import toast from 'react-hot-toast';

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const DEFAULT_DAY_HOURS = {
  regular: { enabled: false, start: '09:00', end: '17:00' },
  evening: { enabled: false, start: '17:00', end: '21:00' },
};

export default function Settings() {
  const { preferences, setRailPosition } = useUIPreferences();
  const [saving, setSaving] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [shopHours, setShopHours] = useState({});
  const [loadingHours, setLoadingHours] = useState(true);

  // Load shop hours on mount
  useEffect(() => {
    async function loadShopHours() {
      try {
        const response = await apiClient('/api/settings');
        const hours = response?.settings?.shop_hours || {};
        // Ensure all days have the expected structure
        const normalizedHours = {};
        DAYS.forEach(({ key }) => {
          const dayData = hours[key] || {};
          normalizedHours[key] = {
            regular: {
              enabled: dayData.regular?.enabled ?? dayData.enabled ?? false,
              start: dayData.regular?.start ?? dayData.open ?? '09:00',
              end: dayData.regular?.end ?? dayData.close ?? '17:00',
            },
            evening: {
              enabled: dayData.evening?.enabled ?? false,
              start: dayData.evening?.start ?? '17:00',
              end: dayData.evening?.end ?? '21:00',
            },
          };
        });
        setShopHours(normalizedHours);
      } catch (err) {
        console.error('Error loading shop hours:', err);
      } finally {
        setLoadingHours(false);
      }
    }
    loadShopHours();
  }, []);

  const handleRailPositionChange = async (position) => {
    setSaving(true);
    await setRailPosition(position);
    setSaving(false);
  };

  const updateDayHours = (day, period, field, value) => {
    setShopHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [period]: {
          ...prev[day]?.[period],
          [field]: value,
        },
      },
    }));
  };

  const saveShopHours = async () => {
    setSavingHours(true);
    try {
      // Try to update existing setting
      await apiClient('/api/settings/shop_hours', {
        method: 'PATCH',
        body: JSON.stringify({ value: shopHours }),
      });
      toast.success('Hours saved');
    } catch (err) {
      // If setting doesn't exist (404), create it
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        try {
          await apiClient('/api/settings', {
            method: 'POST',
            body: JSON.stringify({ 
              key: 'shop_hours',
              value: shopHours,
              description: 'Business operating hours by day'
            }),
          });
          toast.success('Hours saved');
        } catch (createErr) {
          console.error('Error creating shop hours:', createErr);
          toast.error('Failed to save hours');
        }
      } else {
        console.error('Error saving shop hours:', err);
        toast.error('Failed to save hours');
      }
    } finally {
      setSavingHours(false);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: '#0B0F1A' }}>
      <div className="max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-1">Customize your experience</p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* UI Preferences Section */}
          <section 
            className="rounded-xl p-5"
            style={{ 
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="20" height="20" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
              Interface
            </h2>

            {/* Rail Position Setting */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">Navigation Rail Position</label>
              <p className="text-xs text-gray-500 mb-3">
                Choose which side of the screen the navigation menu appears on
              </p>
              
              <div className="flex gap-3">
                {/* Left Option */}
                <button
                  onClick={() => handleRailPositionChange('left')}
                  disabled={saving}
                  className={`flex-1 relative rounded-lg p-4 transition-all ${
                    preferences.railPosition === 'left'
                      ? 'ring-2 ring-cyan-400'
                      : 'hover:bg-white/5'
                  }`}
                  style={{
                    background: preferences.railPosition === 'left' 
                      ? 'rgba(34, 211, 238, 0.1)' 
                      : 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {/* Visual Preview - Left Rail */}
                  <div 
                    className="w-full h-20 rounded-md mb-3 relative overflow-hidden"
                    style={{ background: '#0B0F1A' }}
                  >
                    {/* Left Rail */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-3 rounded-r"
                      style={{ background: 'linear-gradient(to right, #22D3EE, #0B0F1A)' }}
                    />
                    {/* Header */}
                    <div 
                      className="absolute top-0 left-0 right-0 h-2"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    />
                    {/* Content placeholder */}
                    <div className="absolute inset-4 left-6 flex flex-col gap-1">
                      <div className="h-2 w-3/4 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
                      <div className="h-2 w-1/2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${
                      preferences.railPosition === 'left' ? 'text-cyan-400' : 'text-gray-400'
                    }`}>
                      Left Side
                    </span>
                    {preferences.railPosition === 'left' && (
                      <svg viewBox="0 0 24 24" width="18" height="18" style={{ stroke: '#22D3EE', strokeWidth: 2, fill: 'none' }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>

                {/* Right Option */}
                <button
                  onClick={() => handleRailPositionChange('right')}
                  disabled={saving}
                  className={`flex-1 relative rounded-lg p-4 transition-all ${
                    preferences.railPosition === 'right'
                      ? 'ring-2 ring-cyan-400'
                      : 'hover:bg-white/5'
                  }`}
                  style={{
                    background: preferences.railPosition === 'right' 
                      ? 'rgba(34, 211, 238, 0.1)' 
                      : 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {/* Visual Preview - Right Rail */}
                  <div 
                    className="w-full h-20 rounded-md mb-3 relative overflow-hidden"
                    style={{ background: '#0B0F1A' }}
                  >
                    {/* Right Rail with accent */}
                    <div 
                      className="absolute right-0 top-0 bottom-0 w-3 rounded-l"
                      style={{ background: 'linear-gradient(to left, #22D3EE, #0B0F1A)' }}
                    />
                    {/* Header */}
                    <div 
                      className="absolute top-0 left-0 right-0 h-2"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    />
                    {/* Content placeholder */}
                    <div className="absolute inset-4 right-6 flex flex-col gap-1">
                      <div className="h-2 w-3/4 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
                      <div className="h-2 w-1/2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${
                      preferences.railPosition === 'right' ? 'text-cyan-400' : 'text-gray-400'
                    }`}>
                      Right Side
                    </span>
                    {preferences.railPosition === 'right' && (
                      <svg viewBox="0 0 24 24" width="18" height="18" style={{ stroke: '#22D3EE', strokeWidth: 2, fill: 'none' }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              </div>
              
              {saving && (
                <p className="text-xs text-cyan-400 mt-2 flex items-center gap-2">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </p>
              )}
            </div>
          </section>

          {/* Scheduling Section */}
          <section 
            className="rounded-xl p-5"
            style={{ 
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg viewBox="0 0 24 24" width="20" height="20" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Shop Hours
              </h2>
              <button
                onClick={saveShopHours}
                disabled={savingHours || loadingHours}
                className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                style={{
                  background: 'rgba(34, 211, 238, 0.15)',
                  color: '#22D3EE',
                  border: '1px solid rgba(34, 211, 238, 0.3)',
                }}
              >
                {savingHours ? 'Saving...' : 'Save Hours'}
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Configure your working hours. Regular hours cover Morning & Afternoon windows. Evening hours extend availability past 5 PM.
            </p>

            {loadingHours ? (
              <div className="text-gray-500 text-sm py-4">Loading...</div>
            ) : (
              <div className="space-y-3">
                {DAYS.map(({ key, label }) => {
                  const dayHours = shopHours[key] || DEFAULT_DAY_HOURS;
                  const hasAnyHours = dayHours.regular?.enabled || dayHours.evening?.enabled;
                  
                  return (
                    <div 
                      key={key} 
                      className="rounded-lg p-3 transition-all"
                      style={{ 
                        background: hasAnyHours ? 'rgba(34, 211, 238, 0.05)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${hasAnyHours ? 'rgba(34, 211, 238, 0.15)' : 'rgba(255,255,255,0.05)'}`,
                      }}
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-medium ${hasAnyHours ? 'text-white' : 'text-gray-500'}`}>
                          {label}
                        </span>
                        {!hasAnyHours && (
                          <span className="text-xs text-gray-600">Closed</span>
                        )}
                      </div>

                      {/* Regular Hours Row */}
                      <div className="flex items-center gap-3 mb-2">
                        <label className="flex items-center gap-2 min-w-[100px]">
                          <input
                            type="checkbox"
                            checked={dayHours.regular?.enabled || false}
                            onChange={(e) => updateDayHours(key, 'regular', 'enabled', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-900"
                          />
                          <span className="text-sm text-gray-400">Regular</span>
                        </label>
                        
                        {dayHours.regular?.enabled && (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={dayHours.regular?.start || '09:00'}
                              onChange={(e) => updateDayHours(key, 'regular', 'start', e.target.value)}
                              className="px-2 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none"
                            />
                            <span className="text-gray-500 text-sm">to</span>
                            <input
                              type="time"
                              value={dayHours.regular?.end || '17:00'}
                              onChange={(e) => updateDayHours(key, 'regular', 'end', e.target.value)}
                              className="px-2 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Evening Hours Row */}
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 min-w-[100px]">
                          <input
                            type="checkbox"
                            checked={dayHours.evening?.enabled || false}
                            onChange={(e) => updateDayHours(key, 'evening', 'enabled', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-900"
                          />
                          <span className="text-sm text-gray-400">Evening</span>
                        </label>
                        
                        {dayHours.evening?.enabled && (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={dayHours.evening?.start || '17:00'}
                              onChange={(e) => updateDayHours(key, 'evening', 'start', e.target.value)}
                              className="px-2 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none"
                            />
                            <span className="text-gray-500 text-sm">to</span>
                            <input
                              type="time"
                              value={dayHours.evening?.end || '21:00'}
                              onChange={(e) => updateDayHours(key, 'evening', 'end', e.target.value)}
                              className="px-2 py-1 text-sm rounded border border-gray-600 bg-gray-800 text-white focus:border-cyan-500 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Placeholder for future settings */}
          <section 
            className="rounded-xl p-5 opacity-50"
            style={{ 
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="20" height="20" style={{ stroke: '#9CA3AF', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              Notifications
            </h2>
            <p className="text-sm text-gray-500">Coming soon</p>
          </section>

          <section 
            className="rounded-xl p-5 opacity-50"
            style={{ 
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="20" height="20" style={{ stroke: '#9CA3AF', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Account
            </h2>
            <p className="text-sm text-gray-500">Coming soon</p>
          </section>
        </div>
      </div>
    </div>
  );
}

Settings.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};
