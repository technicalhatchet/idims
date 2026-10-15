/** Layered 135° gradients — cyan = book/schedule, orange = call accent. */
export const MARKETING_CTA_GRADIENT = {
  cyan: {
    base: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 48%, #22d3ee 100%)',
    hover: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #67e8f9 100%)',
    shadow: '0 0 22px rgba(34, 211, 238, 0.35)',
    shadowHover: '0 0 30px rgba(34, 211, 238, 0.5)',
  },
  orange: {
    base: 'linear-gradient(135deg, #ea580c 0%, #f97316 45%, #fb923c 100%)',
    hover: 'linear-gradient(135deg, #fb923c 0%, #fdba74 48%, #f97316 100%)',
    shadow: '0 0 22px rgba(249, 115, 22, 0.38)',
    shadowHover: '0 0 32px rgba(249, 115, 22, 0.52)',
  },
};

export const marketingCtaSizeClass = {
  sm: 'px-5 py-2.5 text-sm rounded-lg',
  md: 'px-6 py-3 text-sm rounded-xl',
  lg: 'px-8 py-4 text-base rounded-lg',
  bar: 'py-3 rounded-lg text-base',
};
