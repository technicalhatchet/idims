import FeatureFlagsSettingsPanel from './FeatureFlagsSettingsPanel';
import PortalSchedulingSettingsPanel from './PortalSchedulingSettingsPanel';
import PortalReviewsSettingsPanel from './PortalReviewsSettingsPanel';
import PartsLinksSettingsPanel from './PartsLinksSettingsPanel';
import ApplianceLifespansSettingsPanel from './ApplianceLifespansSettingsPanel';
import MaintenanceTasksSettingsPanel from './MaintenanceTasksSettingsPanel';
import { SettingsAccordion } from './SettingsAccordion';

export default function ClientPortalSettingsAccordions() {
  return (
    <div className="space-y-4">
      <SettingsAccordion
        sectionId="portal-feature-flags"
        title="Feature flags & access"
        summary="Portal wave flags, self-signup, invites, and customer-facing toggles"
      >
        <FeatureFlagsSettingsPanel />
      </SettingsAccordion>
      <SettingsAccordion
        sectionId="portal-scheduling"
        title="Scheduling & booking"
        summary="Portal scheduling windows, tiers, and booking behavior"
      >
        <PortalSchedulingSettingsPanel />
      </SettingsAccordion>
      <SettingsAccordion
        sectionId="portal-reviews"
        title="Reviews & notifications"
        summary="Review request emails and related portal outreach"
      >
        <PortalReviewsSettingsPanel />
      </SettingsAccordion>
      <SettingsAccordion
        sectionId="portal-appliance-data"
        title="Appliance data & maintenance"
        summary="Parts links, lifespan ranges, and maintenance task catalog"
      >
        <div className="space-y-4 p-4">
          <PartsLinksSettingsPanel />
          <ApplianceLifespansSettingsPanel />
          <MaintenanceTasksSettingsPanel />
        </div>
      </SettingsAccordion>
    </div>
  );
}
