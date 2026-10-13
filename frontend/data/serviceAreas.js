import { MARKETING_SERVICES, WHY_CHOOSE_US_HONEST } from '../constants/marketingSiteContent';

export const serviceAreas = {
  toledo: {
    slug: 'toledo',
    name: 'Toledo',
    state: 'OH',
    region: 'NW Ohio',
    description: 'Appliance repair in Toledo — diagnostic-first service when we have availability.',
    phone: '(419) 740-0146',
    coverageRadius: 25,
    nearbyCities: [
      { name: 'Toledo', slug: 'toledo' },
      { name: 'Sylvania', slug: 'sylvania' },
      { name: 'Maumee', slug: 'maumee' },
      { name: 'Perrysburg', slug: 'perrysburg' },
      { name: 'Oregon', slug: 'oregon' },
      { name: 'Holland', slug: 'holland' },
      { name: 'Rossford', slug: 'rossford' },
      { name: 'Waterville', slug: 'waterville' },
      { name: 'Whitehouse', slug: 'whitehouse' },
      { name: 'Monclova', slug: 'monclova' }
    ],
    faqs: [
      {
        q: "Do you offer same-day service in Toledo?",
        a: "We offer same-day diagnostics when slots are open in most cases. Call early for the best availability."
      },
      {
        q: "What brands do you repair?",
        a: "We repair all major brands including Whirlpool, Samsung, LG, GE, Maytag, KitchenAid and more."
      },
      {
        q: "How much does a repair cost?",
        a: "Diagnostic visits start at $89. 50% of your diagnostic fee is applied toward the repair if you proceed."
      }
    ]
  },
  sylvania: {
    slug: 'sylvania',
    name: 'Sylvania',
    state: 'OH',
    region: 'NW Ohio',
    description: 'Expert appliance repair serving Sylvania and surrounding neighborhoods.',
    phone: '(419) 740-0146',
    coverageRadius: 25,
    nearbyCities: [
      { name: 'Sylvania', slug: 'sylvania' },
      { name: 'Toledo', slug: 'toledo' },
      { name: 'Maumee', slug: 'maumee' },
      { name: 'Holland', slug: 'holland' },
      { name: 'Whitehouse', slug: 'whitehouse' },
      { name: 'Monclova', slug: 'monclova' }
    ],
    faqs: [
      {
        q: "Do you offer same-day service in Sylvania?",
        a: "We offer same-day diagnostics when slots are open in Sylvania when availability allows."
      },
      {
        q: "What brands do you repair?",
        a: "We repair all major brands including Whirlpool, Samsung, LG, GE, Maytag, KitchenAid and more."
      },
      {
        q: "How much does a repair cost?",
        a: "Diagnostic visits start at $89. 50% of your diagnostic fee is applied toward the repair if you proceed."
      }
    ]
  },
  maumee: {
    slug: 'maumee',
    name: 'Maumee',
    state: 'OH',
    region: 'NW Ohio',
    description: 'Trusted appliance repair serving Maumee residents with fast, reliable service.',
    phone: '(419) 740-0146',
    coverageRadius: 25,
    nearbyCities: [
      { name: 'Maumee', slug: 'maumee' },
      { name: 'Toledo', slug: 'toledo' },
      { name: 'Perrysburg', slug: 'perrysburg' },
      { name: 'Sylvania', slug: 'sylvania' },
      { name: 'Waterville', slug: 'waterville' },
      { name: 'Monclova', slug: 'monclova' }
    ],
    faqs: [
      {
        q: "Do you offer same-day service in Maumee?",
        a: "We offer same-day diagnostics when slots are open in Maumee when availability allows."
      },
      {
        q: "What brands do you repair?",
        a: "We repair all major brands including Whirlpool, Samsung, LG, GE, Maytag, KitchenAid and more."
      },
      {
        q: "How much does a repair cost?",
        a: "Diagnostic visits start at $89. 50% of your diagnostic fee is applied toward the repair if you proceed."
      }
    ]
  },
  perrysburg: {
    slug: 'perrysburg',
    name: 'Perrysburg',
    state: 'OH',
    region: 'NW Ohio',
    description: 'Professional appliance repair for Perrysburg homes and businesses.',
    phone: '(419) 740-0146',
    coverageRadius: 25,
    nearbyCities: [
      { name: 'Perrysburg', slug: 'perrysburg' },
      { name: 'Toledo', slug: 'toledo' },
      { name: 'Maumee', slug: 'maumee' },
      { name: 'Rossford', slug: 'rossford' },
      { name: 'Waterville', slug: 'waterville' }
    ],
    faqs: [
      {
        q: "Do you offer same-day service in Perrysburg?",
        a: "We offer same-day diagnostics when slots are open in Perrysburg when availability allows."
      },
      {
        q: "What brands do you repair?",
        a: "We repair all major brands including Whirlpool, Samsung, LG, GE, Maytag, KitchenAid and more."
      },
      {
        q: "How much does a repair cost?",
        a: "Diagnostic visits start at $89. 50% of your diagnostic fee is applied toward the repair if you proceed."
      }
    ]
  }
};

export const allCities = Object.values(serviceAreas).map(area => ({
  name: area.name,
  slug: area.slug,
  state: area.state
}));

export function getServiceArea(slug) {
  return serviceAreas[slug] || null;
}

export function getAllServiceAreaSlugs() {
  return Object.keys(serviceAreas);
}

export const localServices = MARKETING_SERVICES.map(
  ({ title, slug, description, icon }) => ({ title, slug, description, icon }),
);

export const whyChooseUs = WHY_CHOOSE_US_HONEST;
