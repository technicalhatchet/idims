import HomeLayoutDiagnosticOptimizedGlow from '../../../components/layouts/HomeLayoutDiagnosticOptimizedGlow';
import HomepageLayoutShellProbe from '../../../components/marketing/HomepageLayoutShellProbe';

/** Preview: full `_app` + diagnostic layout with optimized glow (no production HomeLayout swap). */
export default function Home(props) {
  return <HomepageLayoutShellProbe {...props} />;
}

export function getLayout(page) {
  return <HomeLayoutDiagnosticOptimizedGlow>{page}</HomeLayoutDiagnosticOptimizedGlow>;
}
