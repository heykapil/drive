import crypto from 'crypto';
export function generateRandomUUID() {
  const timehex = new Date().valueOf().toString(16);
  // const uuid = crypto.randomUUID().replace(/-/g, '');
  return timehex;
}
