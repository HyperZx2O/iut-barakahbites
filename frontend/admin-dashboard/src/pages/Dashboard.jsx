import Layout from '../components/Layout';
import HealthGrid from '../components/HealthGrid';
import MetricsPanel from '../components/MetricsPanel';
import ChaosControls from '../components/ChaosControls';

export default function Dashboard() {
  return (
    <Layout>
      {/* Top row — full-width split, same edge-to-edge as ChaosControls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        padding: '24px 16px 0',
        alignItems: 'stretch',
      }}>
        <HealthGrid />
        <MetricsPanel />
      </div>

      {/* Chaos Controls — full width below */}
      <div style={{ padding: '20px 16px 24px' }}>
        <ChaosControls />
      </div>
    </Layout>
  );
}
