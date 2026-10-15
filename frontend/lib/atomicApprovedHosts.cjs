const ATOMIC_AUTH_HOST = {
  MARKETING_APEX: 'atomicrepair419.com',
  MARKETING_WWW: 'www.atomicrepair419.com',
  PORTAL: 'portal.atomicrepair419.com',
  IDIMS: 'idims.atomicrepair419.com',
};

const ATOMIC_AUTH_HOST_SET = new Set(Object.values(ATOMIC_AUTH_HOST));

function isAtomicAuthHost(hostname) {
  const h = String(hostname || '').toLowerCase().split(':')[0];
  return ATOMIC_AUTH_HOST_SET.has(h);
}

module.exports = {
  ATOMIC_AUTH_HOST,
  ATOMIC_AUTH_HOST_SET,
  isAtomicAuthHost,
};
