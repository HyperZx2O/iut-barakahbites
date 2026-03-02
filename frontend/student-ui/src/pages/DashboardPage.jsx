import Layout from '../components/Layout';
import OrderForm from '../components/OrderForm';
import StatusTracker from '../components/StatusTracker';

export default function DashboardPage() {
  return (
    <Layout>
      {/* Centered flex row — both panels sit side by side, centered on page */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        padding: '24px 16px',
        justifyContent: 'center',
        alignItems: 'flex-start'
      }}>
        <OrderForm />
        <StatusTracker />
      </div>
    </Layout>
  );
}
