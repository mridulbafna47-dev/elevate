/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { NavViewId } from './types/finance';
import { ElevateProvider, useElevate } from './context/ElevateContext';
import { LandingPage } from './components/landing/LandingPage';
import { AppShell } from './components/layout/AppShell';
import { DashboardPillar } from './components/pillars/DashboardPillar';
import { FlowPillar } from './components/pillars/FlowPillar';
import { GuidePillar } from './components/pillars/GuidePillar';
import { WealthPillar } from './components/pillars/WealthPillar';
import { SecurePillar } from './components/pillars/SecurePillar';
import { ReportsPillar } from './components/pillars/ReportsPillar';
import { SettingsPillar } from './components/pillars/SettingsPillar';

function ElevateRouter() {
  const { user } = useElevate();
  const [activeView, setActiveView] = useState<NavViewId>('dashboard');

  const handleSelectView = (view: NavViewId) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!user) {
    return <LandingPage />;
  }

  return (
    <AppShell activeView={activeView} onSelectView={handleSelectView}>
      {activeView === 'dashboard' && (
        <DashboardPillar onNavigate={handleSelectView} />
      )}
      {activeView === 'flow' && <FlowPillar />}
      {activeView === 'guide' && <GuidePillar />}
      {activeView === 'wealth' && <WealthPillar />}
      {activeView === 'secure' && <SecurePillar />}
      {activeView === 'reports' && (
        <ReportsPillar onNavigate={handleSelectView} />
      )}
      {activeView === 'settings' && <SettingsPillar />}
    </AppShell>
  );
}

export default function App() {
  return (
    <ElevateProvider>
      <ElevateRouter />
    </ElevateProvider>
  );
}
