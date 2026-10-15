import LogitApp from '../../components/logit/LogitApp';
import LogitHead from '../../components/logit/LogitHead';
import { isLogitSubdomainHost } from '../../lib/logitSubdomainHost';

export default function LogitPage({ useSubdomainManifest }) {
  return (
    <>
      <LogitHead useSubdomainManifest={useSubdomainManifest} />
      <LogitApp />
    </>
  );
}

export async function getServerSideProps({ req }) {
  const forwarded = req.headers['x-forwarded-host'] || req.headers.host || '';
  const host = String(forwarded).split(',')[0].trim();
  return {
    props: {
      useSubdomainManifest: isLogitSubdomainHost(host),
    },
  };
}
