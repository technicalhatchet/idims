import Head from 'next/head';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout({ children, title = 'Client Portal', user }) {
  return (
    <>
      <Head>
        <title>{title} | Atomic Repair</title>
        <meta name="description" content="Manage your appliance repairs, appointments, and invoices." />
      </Head>

      <div className="min-h-screen bg-[#0B0F1A]">
        <Sidebar />
        <div className="ml-64">
          <Topbar user={user} />
          <main className="p-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
