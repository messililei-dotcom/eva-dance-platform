function isLocalOrigin(value) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '0.0.0.0'
      || hostname === '::1';
  } catch {
    return false;
  }
}

function resolveServiceOrigin({ value, nodeEnv, productionFallback, developmentFallback }) {
  const configured = String(value || '').trim();
  if (nodeEnv === 'production') {
    if (!configured || isLocalOrigin(configured)) return productionFallback;
    return configured.replace(/\/+$/, '');
  }
  return (configured || developmentFallback).replace(/\/+$/, '');
}

module.exports = {
  isLocalOrigin,
  resolveServiceOrigin,
};

