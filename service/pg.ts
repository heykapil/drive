import { Pool, QueryResult, QueryResultRow } from 'pg';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export type Primitive = string | number | number[] | boolean | undefined | null;

export const query = async <T extends QueryResultRow = QueryResultRow>(
  queryString: string,
  values: Primitive[] = [],
): Promise<QueryResult<T>> => {
  const client = await pool.connect();
  let response: QueryResult<T>;
  try {
    response = await client.query<T>(queryString, values);
  } catch (err: unknown) {
    // Normalize and rethrow as an Error to preserve message and stack
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(String(err));
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
        ? `[${array.map(i => `'${i}'`).join(',')}]`
        : `(${array.map(i => `'${i}'`).join(',')})`
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
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err || 'Unknown error');
    return { status: 'Error', message };
  }
};
