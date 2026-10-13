import HomeLayoutDiagnosticNoGlow from '../../../components/layouts/HomeLayoutDiagnosticNoGlow';
import HomepageLayoutShellProbe from '../../../components/marketing/HomepageLayoutShellProbe';

/** Preview: full `_app` + diagnostic layout (no glow); same fuchsia probe as layout_shell_probe. */
export default function Home(props) {
  return <HomepageLayoutShellProbe {...props} />;
}

export function getLayout(page) {
  return <HomeLayoutDiagnosticNoGlow>{page}</HomeLayoutDiagnosticNoGlow>;
}
