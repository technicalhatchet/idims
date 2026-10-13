import HomeLayout from '../../../components/layouts/HomeLayout';
import HomepageLayoutShellProbe from '../../../components/marketing/HomepageLayoutShellProbe';

/** Preview: full `_app` + real HomeLayout; no marketing hero or below-fold. */
export default function Home(props) {
  return <HomepageLayoutShellProbe {...props} />;
}

export function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
}
