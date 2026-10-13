import HomeLayout from '../../../components/layouts/HomeLayout';
import HomepageMarketingPage from '../../../components/marketing/HomepageMarketingPage';

/** Production + hero_static / hero_only / full marketing homepage. */
export default function Home(props) {
  return <HomepageMarketingPage {...props} />;
}

export function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
}
