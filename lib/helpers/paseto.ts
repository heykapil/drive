'use server'
import { V3, V4 } from 'paseto';
interface SignOption {
  expiresIn?: string;
  issuer?: string;
}
const secretKey = process.env.PASETO_SECRET_KEY!;
const publicKey = process.env.PASETO_PUBLIC_KEY!;
const localKey = process.env.PASETO_LOCAL_KEY!;

const DefaultSignOption: SignOption = {
  expiresIn: '1 day',
};

export async function signPasetoToken({
  payload,
  key,
  options,
}: {
  payload: any;
  key?: string;
  options?: SignOption;
}) {
  try {
    const token = await V4.sign(
      payload,
      key || secretKey,
      options || DefaultSignOption
    );
    return token.slice(10);
  } catch (e) {
    console.log(e);
    return null;
  }
}

export async function verifyPasetoToken({
  token,
  key,
}: {
  token: string;
  key?: string;
}) {
  try {
    const encodedToken = 'v4.public.' + token;
    const payload = await V4.verify(encodedToken, key || publicKey);
    return JSON.parse(JSON.stringify(payload));
  } catch (e) {
    console.log(e);
    return null;
  }
}

export async function encryptToken(payload: any, options?: any) {
  try {
    const token = await V3.encrypt(
      payload,
      localKey,
      options || DefaultSignOption
    );
    return token.slice(9);
  } catch (e) {
    console.log(e)
    return null;
  }
}

export async function decryptToken(token: string) {
  try {
    const payload = await V3.decrypt('v3.local.' + token, localKey);
    return JSON.parse(JSON.stringify(payload));
  } catch (e) {
    console.log(e);
    return null;
  }
}
