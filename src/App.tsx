/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { PillarId } from './types/finance';
import { ElevateProvider } from './context/ElevateContext';
import { AppShell } from './components/layout/AppShell';
import { OverviewPillar } from './components/pillars/OverviewPillar';
import { FlowPillar } from './components/pillars/FlowPillar';
import { GuidePillar } from './components/pillars/GuidePillar';
import { WealthPillar } from './components/pillars/WealthPillar';
import { SecurePillar } from './components/pillars/SecurePillar';

export default function App() {
  const [activePillar, setActivePillar] = useState<PillarId>('overview');

  const handleSelectPillar = (pillar: PillarId) => {
    setActivePillar(pillar);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ElevateProvider>
      <AppShell
        activePillar={activePillar}
        onSelectPillar={handleSelectPillar}
      >
        {activePillar === 'overview' && (
          <OverviewPillar onNavigate={handleSelectPillar} />
        )}
        {activePillar === 'flow' && <FlowPillar />}
        {activePillar === 'guide' && <GuidePillar />}
        {activePillar === 'wealth' && <WealthPillar />}
        {activePillar === 'secure' && <SecurePillar />}
      </AppShell>
    </ElevateProvider>
  );
}
