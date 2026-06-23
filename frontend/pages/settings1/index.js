/**
 * Settings page - application-wide configuration
 * Admin/Manager only
 * 
 * Place at: frontend/pages/settings/index.js
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { apiClient } from '../../utils/api-client';
import { FaSave, FaUndo, FaCog, FaClock, FaPalette, FaBell } from 'react-icons/fa';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'business', label: 'Business', icon: FaCog },
  { id: 'scheduling', label: 'Scheduling', icon: FaClock },
  { id: 'ui', label: 'UI & Theme', icon: FaPalette },
  { id: 'notifications', label: 'Notifications', icon: FaBell },
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('business');
  const [settings, setSettings] = useState({});
  const [originalSettings, setOriginalSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await apiClient('settings');
      setSettings(response.settings || {});
      setOriginalSettings(response.settings || {});
    } catch (err) {
      console.error('Error fetching settings:', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    setSaving(true);
    try {
      await apiClient(`settings/${key}`, {
        method: 'PATCH',
        body: JSON.stringify({ value }),
      });
      toast.success('Setting saved');
      // Update both current and original to reflect saved state
      setSettings(prev => ({ ...prev, [key]: value }));
      setOriginalSettings(prev => ({ ...prev, [key]: value }));
    } catch (err) {
      console.error(`Error updating setting ${key}:`, err);
      toast.error('Failed to save setting');
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const changedKeys = Object.keys(settings).filter(
        key => JSON.stringify(settings[key]) !== JSON.stringify(originalSettings[key])
      );

      await Promise.all(
        changedKeys.map(key =>
          apiClient(`settings/${key}`, {
            method: 'PATCH',
            body: JSON.stringify({ value: settings[key] }),
          })
        )
      );

      setOriginalSettings({ ...settings });
      toast.success('All settings saved');
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save some settings');
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setSettings({ ...originalSettings });
    toast.success('Changes discarded');
  };

  const updateShopHours = (day, field, value) => {
    setSettings(prev => ({
      ...prev,
      shop_hours: {
        ...prev.shop_hours,
        [day]: {
          ...prev.shop_hours[day],
          [field]: value,
        },
      },
    }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading settings...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Settings | IDIMS</title>
      </Head>

      <div className="px-4 py-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Configure application-wide behavior
            </p>
          </div>

          {hasChanges && (
            <div className="flex gap-2">
              <button
                onClick={resetAll}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <FaUndo className="inline mr-2" />
                Discard
              </button>
              <button
                onClick={saveAll}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <FaSave className="inline mr-2" />
                {saving ? 'Saving...' : 'Save All'}
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="inline mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          {activeTab === 'business' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tax Rate
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  value={settings.tax_rate || 0}
                  onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) })}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Decimal format (e.g., 0.0675 = 6.75%)</p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.service_area_enabled || false}
                    onChange={(e) => setSettings({ ...settings, service_area_enabled: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enforce Service Area Restrictions
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  When enabled, bookings outside the radius will be blocked
                </p>
              </div>

              {settings.service_area_enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Service Area Radius (miles)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings.service_radius_miles || 25}
                      onChange={(e) => setSettings({ ...settings, service_radius_miles: parseInt(e.target.value) })}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">Straight-line distance from shop</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Shop Address
                    </label>
                    <input
                      type="text"
                      value={settings.shop_address?.address || ''}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        shop_address: { ...settings.shop_address, address: e.target.value }
                      })}
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">Address used for service area calculations</p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Parts Markup (%)
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.parts_markup_percentage || 0}
                  onChange={(e) => setSettings({ ...settings, parts_markup_percentage: parseInt(e.target.value) })}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Warranty (days)
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.default_warranty_days || 0}
                  onChange={(e) => setSettings({ ...settings, default_warranty_days: parseInt(e.target.value) })}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Diagnostic Fee Behavior
                </label>
                <select
                  value={settings.diagnostic_fee_behavior || 'manual'}
                  onChange={(e) => setSettings({ ...settings, diagnostic_fee_behavior: e.target.value })}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="manual">Manual Decision</option>
                  <option value="auto_waive">Auto-waive on Approval</option>
                  <option value="always_charge">Always Charge</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Invoice Payment Terms
                </label>
                <select
                  value={settings.invoice_terms || 'due_on_receipt'}
                  onChange={(e) => setSettings({ ...settings, invoice_terms: e.target.value })}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="due_on_receipt">Due on Receipt</option>
                  <option value="net_15">Net 15</option>
                  <option value="net_30">Net 30</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'scheduling' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Shop Hours</h3>
                <div className="space-y-3">
                  {DAYS.map(day => (
                    <div key={day} className="flex items-center gap-4">
                      <div className="w-28 font-medium text-gray-700 dark:text-gray-300 capitalize">
                        {day}
                      </div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.shop_hours?.[day]?.enabled || false}
                          onChange={(e) => updateShopHours(day, 'enabled', e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Open</span>
                      </label>
                      {settings.shop_hours?.[day]?.enabled && (
                        <>
                          <input
                            type="time"
                            value={settings.shop_hours[day].open || '08:00'}
                            onChange={(e) => updateShopHours(day, 'open', e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                          <span className="text-gray-500">to</span>
                          <input
                            type="time"
                            value={settings.shop_hours[day].close || '17:00'}
                            onChange={(e) => updateShopHours(day, 'close', e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Travel Buffer (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.travel_buffer_minutes || 0}
                  onChange={(e) => setSettings({ ...settings, travel_buffer_minutes: parseInt(e.target.value) })}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Time between appointments for travel</p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.extended_hours_enabled || false}
                    onChange={(e) => setSettings({ ...settings, extended_hours_enabled: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enable Evening & Weekend Appointments
                  </span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'ui' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Accent Color
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="accent_color"
                      value="orange"
                      checked={settings.accent_color === 'orange'}
                      onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })}
                      className="mr-2"
                    />
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-orange-500" />
                      <span>Orange</span>
                    </div>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="accent_color"
                      value="cyan"
                      checked={settings.accent_color === 'cyan'}
                      onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })}
                      className="mr-2"
                    />
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-cyan-500" />
                      <span>Cyan</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Configure which channels to use for each event type
              </p>
              {settings.notification_preferences && Object.entries(settings.notification_preferences).map(([event, channels]) => (
                <div key={event} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {event.replace(/_/g, ' ')}
                  </span>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={channels.sms || false}
                        onChange={(e) => setSettings({
                          ...settings,
                          notification_preferences: {
                            ...settings.notification_preferences,
                            [event]: { ...channels, sms: e.target.checked },
                          },
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">SMS</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={channels.email || false}
                        onChange={(e) => setSettings({
                          ...settings,
                          notification_preferences: {
                            ...settings.notification_preferences,
                            [event]: { ...channels, email: e.target.checked },
                          },
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Email</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

SettingsPage.getLayout = (page) => <DashboardLayout>{page}</DashboardLayout>;

export default SettingsPage;
