import FeatureFlagsSettingsPanel from './FeatureFlagsSettingsPanel';
import PortalSchedulingSettingsPanel from './PortalSchedulingSettingsPanel';
import PortalReviewsSettingsPanel from './PortalReviewsSettingsPanel';
import PartsLinksSettingsPanel from './PartsLinksSettingsPanel';
import ApplianceLifespansSettingsPanel from './ApplianceLifespansSettingsPanel';
import MaintenanceTasksSettingsPanel from './MaintenanceTasksSettingsPanel';
import {
  NestedSettingsAccordionGroup,
  SettingsAccordion,
} from './SettingsAccordion';

const APPLIANCE_NESTED = {
  groupId: 'client-portal::portal-appliance-data',
  sections: ['portal-parts-links', 'portal-lifespans', 'portal-maintenance-tasks'],
};

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
        summary="Portal scheduling windows, tiers, Square billing, and booking behavior"
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
        <NestedSettingsAccordionGroup
          groupId={APPLIANCE_NESTED.groupId}
          sectionIds={APPLIANCE_NESTED.sections}
        >
          <SettingsAccordion
            nested
            sectionId="portal-parts-links"
            title="Parts links"
            summary="Customer-facing parts lookup URLs"
          >
            <div className="p-4 pt-0">
              <PartsLinksSettingsPanel />
            </div>
          </SettingsAccordion>
          <SettingsAccordion
            nested
            sectionId="portal-lifespans"
            title="Appliance lifespans"
            summary="Expected life ranges by appliance type"
          >
            <div className="p-4 pt-0">
              <ApplianceLifespansSettingsPanel />
            </div>
          </SettingsAccordion>
          <SettingsAccordion
            nested
            sectionId="portal-maintenance-tasks"
            title="Maintenance"
            summary="Maintenance reminder task catalog"
          >
            <div className="p-4 pt-0">
              <MaintenanceTasksSettingsPanel />
            </div>
          </SettingsAccordion>
        </NestedSettingsAccordionGroup>
      </SettingsAccordion>
    </div>
  );
}
