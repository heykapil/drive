import { Pool, QueryResult, QueryResultRow } from 'pg';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
      ca: `-----BEGIN CERTIFICATE-----
      MIIETTCCArWgAwIBAgIUFo2h1RMbMHbDUop3J5pD17CxUWUwDQYJKoZIhvcNAQEM
      BQAwQDE+MDwGA1UEAww1OTgzNWEyODEtODJkNi00Zjc2LTgwOTAtZTg1N2RhNzZm
      ZjFiIEdFTiAxIFByb2plY3QgQ0EwHhcNMjUwMjExMTEwNjIxWhcNMzUwMjA5MTEw
      NjIxWjBAMT4wPAYDVQQDDDU5ODM1YTI4MS04MmQ2LTRmNzYtODA5MC1lODU3ZGE3
      NmZmMWIgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
      AYoCggGBAMWXKOu0G0THPIb0aRDwr+XX7OBZZGNXaDMV6Vvsisan3kW5a38SDAOD
      /MO3JLUa2YXrHJtv2uKKF7RVWHbfFAmFMvZUhtmJyb4KdRpGw6IkoIYrL4P/dby1
      1Pj/dRANgwBhh+utmq+w4dPE0DkSoU2Ahcg+u5neAq7kyNGFPOOVZftIF3khe/Bw
      el7kNrcsr/63VLyXqE5HU9CE8DMqvf+O0+R7Tv+oPf3DjK6PVfwBHKCMwmj76o7W
      VI0e4IrRLJKOjmYylzF1MMpNFzORw4mxiIA7IZ88JhYzQHgZy5kFKS7Iasf8dA7V
      oO4G5IV/REXp7urRHyUL7t4Qt5dPHoSS0ehgZmVAg8ktpCMVAUhtPMspdAHdTn4w
      4Dx7ciiYz5VM2dzfAgnnm8HVdBSbxFkJcyc6qoHfh6l0RXIl5GUTEpWf1C0WI/zv
      3Bk7QmpwiwBQBN8Ix6rvnUAZpMMYaq8ZcZ7bYfAEB8uWVp6Up5VKdyfKCCfVEiAv
      HYQvkG9U2QIDAQABoz8wPTAdBgNVHQ4EFgQUXNSQogmF5TU9BQbxayi3TcSd0cUw
      DwYDVR0TBAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGB
      AGIlyzPfUTNGe4tNsf/JPdwSb8QzU7seR2BMNnH0R0DFr+7AM0r8vb0JBU8as8F+
      bht56yP2Dc5pbxqtXqkmZv/yywn7UsY9pWBZVOoWT5fX7Nw/QLbilpuNsi7Fl4wS
      N31itn9UW9hVpYJHFGViDwKal8yGILZ7lMlJtWiIohEyxwbJjaWy2j8j0p9clbsg
      6G10fD0YpqdWcfKEnltzV12PhQUL4P17qPvANckW0+rdZ7NL/uJ0LQNYeSIM7Ygv
      YBAsaG1sCqJlsH9MGE1/P62zWnBkdhZRtoHTiDxoRogJZmz1T+yP5fZ7+d1xyw/n
      /N9YK3GW0BU0vJYP+gMDIVvfX142mZUZprqb99C5/LoNVv4lgQJEsC1oL3J+E4+h
      FU1AAzhaYyQO+15N/rDeMvkfvcxKa1zmbMp4tfEJCsVC9vnyTJgM6SEnEhq62QWp
      Ug+rJU9tiFJVikdnr9nlMSelnbrd/8wa4yNzijkpmxo6bToUNW9iebA5f7JVBlr0
      dQ==
      -----END CERTIFICATE-----`,
    },
  })

export type Primitive = string | number | boolean | undefined | null;

// @ts-ignore
export const query = async <T extends QueryResultRow = any>(
  queryString: string,
  values: Primitive[] = [],
) => {
  const client = await pool.connect();
  let response: QueryResult<T>;
  try {
    response = await client.query<T>(queryString, values);
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
  return response;
};

export const sql = <T extends QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: Primitive[]
) => {
  if (!isTemplateStringsArray(strings) || !Array.isArray(values)) {
    throw new Error('Invalid template literal argument');
  }

  let result = strings[0] ?? '';

  for (let i = 1; i < strings.length; i++) {
    result += `$${i}${strings[i] ?? ''}`;
  }

  return query<T>(result, values);
};

export const convertArrayToPostgresString = (
  array?: string[],
  type: 'braces' | 'brackets' | 'parentheses' = 'braces',
) =>
  array
    ? type === 'braces'
      ? `{${array.join(',')}}`
      : type === 'brackets'
        ? `[${array.map((i) => `'${i}'`).join(',')}]`
        : `(${array.map((i) => `'${i}'`).join(',')})`
    : null;

const isTemplateStringsArray = (
  strings: unknown,
): strings is TemplateStringsArray => {
  return (
    Array.isArray(strings) && 'raw' in strings && Array.isArray(strings.raw)
  );
};

export const testDBConnection = async () => {
  try {
      await query('SELECT NOW()'); // Simple query to test connection
      return { status: 'Success' };
    } catch (error: any) {
      return { status: 'Error', message: error.message };
    }
}
