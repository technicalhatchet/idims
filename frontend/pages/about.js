import Head from 'next/head';
import HomeLayout from '../components/layouts/HomeLayout';

export default function About() {
  return (
    <>
      <Head>
        <title>About Us | Atomic Repair</title>
      </Head>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#EAF6FF' }}>
            About Us
          </h1>
          <p className="text-lg" style={{ color: '#9FB3C8' }}>
            Fast, reliable appliance repair you can count on.
          </p>
        </div>
        
        <div className="space-y-8">
          <div 
            className="p-8 rounded-2xl border"
            style={{ backgroundColor: '#000811', borderColor: '#1A2A3A' }}
          >
            <p style={{ color: '#9FB3C8' }} className="text-lg leading-relaxed">
              Atomic Repair is an owner-operated appliance repair service based in Toledo. We diagnose and repair
              major household appliances and TVs across Northwest Ohio.
            </p>
          </div>
          
          <div 
            className="p-8 rounded-2xl border"
            style={{ backgroundColor: '#000811', borderColor: '#1A2A3A' }}
          >
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#00E5FF' }}>Our Mission</h2>
            <p style={{ color: '#9FB3C8' }} className="leading-relaxed">
              To provide honest, reliable appliance repair with clear pricing and respectful communication —
              the way we would want service in our own homes.
            </p>
          </div>
          
          <div 
            className="p-8 rounded-2xl border"
            style={{ backgroundColor: '#000811', borderColor: '#1A2A3A' }}
          >
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#FF7A1A' }}>Our Promise</h2>
            <p style={{ color: '#9FB3C8' }} className="leading-relaxed">
              Same-day diagnostics when available, upfront pricing, and a 90-day warranty on repairs we complete. 
              Your diagnostic fee is never wasted - if you approve the repair, it applies toward 
              the repair cost. If a repair attempt is unsuccessful, you won't be charged labor for that repair.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// Use the home layout
About.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
}; 