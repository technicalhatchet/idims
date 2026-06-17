import Head from 'next/head';

export default function PortalComingSoon({ title, description, icon: Icon }) {
  return (
    <>
      <Head><title>{title} | Atomic Repair</title></Head>
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        {Icon && (
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5">
            <Icon className="w-8 h-8 text-cyan-400" />
          </div>
        )}
        <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
        <p className="text-gray-400 max-w-md text-sm leading-relaxed">{description}</p>
        <p className="text-gray-500 text-xs mt-6">
          Need help now? Call{' '}
          <a href="tel:4197941689" className="text-cyan-400 hover:text-cyan-300">(419) 794-1689</a>
          {' '}or email{' '}
          <a href="mailto:service@atomicrepair419.com" className="text-cyan-400 hover:text-cyan-300">
            service@atomicrepair419.com
          </a>
        </p>
      </div>
    </>
  );
}
