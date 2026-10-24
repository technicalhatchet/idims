/**
 * Dev-only layout preview for Wave 2 settings panels (375px screenshots).
 * Visit /dev/wave2-settings-preview when logged in as admin/manager.
 */
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import PartsLinksSettingsPanel from '../../components/settings/PartsLinksSettingsPanel';
import ApplianceLifespansSettingsPanel from '../../components/settings/ApplianceLifespansSettingsPanel';
import NavCountBadge from '../../components/navigation/NavCountBadge';

export default function Wave2SettingsPreviewPage() {
  return (
    <div className="mx-auto max-w-[375px] p-4 space-y-8" style={{ background: '#0B0F1A' }}>
      <section>
        <p className="text-gray-500 text-xs mb-2">Recall nav badge (sample)</p>
        <div className="flex items-center gap-2 text-white text-sm font-medium">
          Recall review
          <NavCountBadge count={3} />
        </div>
      </section>
      <PartsLinksSettingsPanel />
      <ApplianceLifespansSettingsPanel />
    </div>
  );
}

Wave2SettingsPreviewPage.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};
