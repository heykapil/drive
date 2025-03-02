import crypto from 'crypto';
import { randomHex } from './randomHex';
export function generateState() {
  const shuffle = (str: any) =>
    [...str].sort(() => Math.random() - 0.5).join('');
  const timehex = crypto
    .createHash('md5')
    .update(new Date().valueOf().toString(16))
    .digest('hex');
  const rand = randomHex(8);
  return `state_` + timehex + shuffle(rand);
}
