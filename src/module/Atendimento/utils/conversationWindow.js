export const isWithin24Hours = (timestamp) => {
  if (!timestamp) return false;
  const now = Date.now();
  const last = new Date(timestamp).getTime();
  return now - last <= 24 * 60 * 60 * 1000;
};
