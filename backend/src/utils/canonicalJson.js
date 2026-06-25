const normalizeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value !== null && typeof value === 'object') {
    const normalized = {};

    Object.keys(value)
      .sort()
      .forEach((key) => {
        normalized[key] = normalizeValue(value[key]);
      });

    return normalized;
  }

  return value;
};

const canonicalStringify = (value) => JSON.stringify(normalizeValue(value));

module.exports = {
  canonicalStringify,
};
