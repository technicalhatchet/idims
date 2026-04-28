import Head from 'next/head';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout({ children, title = 'Client Portal' }) {
  return (
    <>
      <Head>
        <title>{title} | Quantum Repair</title>
        <meta name="description" content="Manage your appliance repairs, appointments, and invoices." />
      </Head>

      <div className="min-h-screen bg-[#0B0F1A]">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="ml-64">
          {/* Topbar */}
          <Topbar />

          {/* Page Content */}
          <main className="p-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
