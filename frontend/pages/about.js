import Head from 'next/head';
import HomeLayout from '../components/layouts/HomeLayout';

export default function About() {
  return (
    <>
      <Head>
        <title>About Us | Atomic Repair</title>
      </Head>

      {/* Background - Atomic Theme */}
      <div 
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
        style={{ backgroundColor: '#000208' }}
      >
        <div 
          className="absolute blur-[120px] md:blur-[180px] w-[300px] h-[300px] md:w-[700px] md:h-[700px] -top-[50px] -left-[100px] md:-top-[100px] md:-left-[200px]"
          style={{ backgroundColor: 'rgba(0, 229, 255, 0.15)' }}
        />
        <div 
          className="absolute blur-[100px] md:blur-[150px] w-[250px] h-[250px] md:w-[500px] md:h-[500px] bottom-[15%] -right-[50px] md:bottom-[20%] md:-right-[100px]"
          style={{ backgroundColor: 'rgba(255, 122, 26, 0.18)' }}
        />
      </div>
      
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
              Atomic Repair provides expert appliance repair services across Toledo and Northwest Ohio. 
              Our certified technicians are equipped to handle all major brands and appliance types.
            </p>
          </div>
          
          <div 
            className="p-8 rounded-2xl border"
            style={{ backgroundColor: '#000811', borderColor: '#1A2A3A' }}
          >
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#00E5FF' }}>Our Mission</h2>
            <p style={{ color: '#9FB3C8' }} className="leading-relaxed">
              To provide fast, honest, and reliable appliance repair services with transparent pricing 
              and exceptional customer service. As a family-owned and operated business, we pride 
              ourselves on our commitment to quality and customer satisfaction.
            </p>
          </div>
          
          <div 
            className="p-8 rounded-2xl border"
            style={{ backgroundColor: '#000811', borderColor: '#1A2A3A' }}
          >
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#FF7A1A' }}>Our Promise</h2>
            <p style={{ color: '#9FB3C8' }} className="leading-relaxed">
              Same-day service, upfront pricing, and a 90-day warranty on all repairs. 
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