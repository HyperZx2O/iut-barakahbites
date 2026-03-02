import { useCallback, useState } from 'react';
import Layout from '../components/Layout';
import HealthGrid from '../components/HealthGrid';
import MetricsPanel from '../components/MetricsPanel';
import ChaosControls from '../components/ChaosControls';
import StockManager from '../components/StockManager';
import GatewayAlert from '../components/GatewayAlert';

export default function Dashboard() {
  // alertState tracks { isActive, latencyMs, dismissed }
  // "dismissed" means the user clicked Dismiss — we silence this exact alert
  // episode until the condition clears and then re-triggers.
  const [alertState, setAlertState] = useState({
    isActive: false,
    latencyMs: 0,
    dismissed: false,
  });

  // Called by MetricsPanel whenever the Order Gateway crosses / clears the threshold
  const handleAlertChange = useCallback((serviceName, isAlerting, latencyMs) => {
    if (serviceName !== 'Order Gateway') return;

    setAlertState(prev => ({
      isActive: isAlerting,
      latencyMs,
      // When the alert clears (isAlerting goes false → true again), reset dismissed
      // so the next episode is shown again even if the user previously dismissed it.
      dismissed: isAlerting ? prev.dismissed : false,
    }));
  }, []);

  const handleDismiss = useCallback(() => {
    setAlertState(prev => ({ ...prev, dismissed: true }));
  }, []);

  // Show the banner only when active AND not dismissed
  const showAlert = alertState.isActive && !alertState.dismissed;

  return (
    <Layout>
      {/* Fixed-position latency alert — renders above everything, zero layout shift */}
      <GatewayAlert
        isActive={showAlert}
        latencyMs={alertState.latencyMs}
        onDismiss={handleDismiss}
      />

      {/* Top row — full-width split, same edge-to-edge as ChaosControls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        padding: '24px 16px 0',
        alignItems: 'stretch',
      }}>
        <HealthGrid />
        <MetricsPanel onAlertChange={handleAlertChange} />
        <StockManager />
      </div>

      {/* Chaos Controls — full width below */}
      <div style={{ padding: '20px 16px 24px' }}>
        <ChaosControls />
      </div>
    </Layout>
  );
}
