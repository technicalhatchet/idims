import HomeLayoutDiagnosticOptimizedGlow from '../../../components/layouts/HomeLayoutDiagnosticOptimizedGlow';
import HomepageMarketingPage from '../../../components/marketing/HomepageMarketingPage';

/** Preview: full marketing homepage with optimized glow (production HomeLayout unchanged). */
export default function Home(props) {
  return <HomepageMarketingPage {...props} />;
}

export function getLayout(page) {
  return <HomeLayoutDiagnosticOptimizedGlow>{page}</HomeLayoutDiagnosticOptimizedGlow>;
}
