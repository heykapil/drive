import postgres from 'postgres';

// Ensure environment variables are defined
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL_NEON) {
  throw new Error('Database URLs are missing in environment variables.');
}

// Define a global type to prevent TypeScript errors on the global object
const globalForDb = globalThis as unknown as {
  mainDB: postgres.Sql | undefined;
  fallbackDB: postgres.Sql | undefined;
};

// CONFIGURATION
// Reduce max connections. 10 is often too high for serverless or dev.
// Use 1 or 2 for serverless/dev, higher for dedicated servers.
// idle_timeout: Close connection if not used for X seconds.
const CONFIG = {
  ssl: false,
  prepare: false,
  max: process.env.NODE_ENV === 'production' ? 5 : 1,
  idle_timeout: 20,
  connect_timeout: 10,
};

// SINGLETON PATTERN:
// Check if a connection already exists in the global scope.
// If it does, reuse it. If not, create a new one.

export const mainDB =
  globalForDb.mainDB ||
  postgres(process.env.DATABASE_URL, CONFIG);

export const fallbackDB =
  globalForDb.fallbackDB ||
  postgres(process.env.DATABASE_URL_NEON, CONFIG);

// Save the instance to global scope if we are not in production
// This prevents connections from stacking up during hot-reloads in development
if (process.env.NODE_ENV !== 'production') {
  globalForDb.mainDB = mainDB;
  globalForDb.fallbackDB = fallbackDB;
}

// --- Rest of your logic remains the same ---

export type Primitive =
  | string
  | number
  | boolean
  | null
  | undefined
  | Primitive[];

const isWriteQuery = (queryString: string) => {
  const writeKeywords =
    /^(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|SET|COMMENT|MERGE|CALL)\s/i;
  return writeKeywords.test(queryString.trim());
};

export const sql = mainDB;

export const query = async <T = any>(
  queryString: string,
  values: Primitive[] = [],
): Promise<{ rows: T[] }> => {
  const db = isWriteQuery(queryString) ? mainDB : fallbackDB;
  try {
    // @ts-ignore
    const result = await db.unsafe<T[]>(queryString, values);
    return { rows: result };
  } catch (error) {
    console.error('DB Query Error:', error);
    throw error;
  }
};

export const sqlQuery = async <T = any>(
  strings: TemplateStringsArray,
  ...values: Primitive[]
): Promise<T[]> => {
  const queryString = strings.join('?');
  const db = isWriteQuery(queryString) ? mainDB : fallbackDB;
  try {
    // @ts-ignore
    return await db.unsafe<T[]>(queryString, values);
  } catch (error) {
    console.error('SQL Query Error:', error);
    throw error;
  }
};

export const testDBConnection = async (): Promise<
  Record<string, { status: string; message?: string }>
> => {
  const results: Record<string, { status: string; message?: string }> = {};

  try {
    await mainDB`SELECT NOW()`;
    results.mainDB = { status: 'Success' };
  } catch (error: unknown) {
    results.mainDB = { status: 'Error', message: (error as Error).message };
  }

  try {
    await fallbackDB`SELECT NOW()`;
    results.fallbackDB = { status: 'Success' };
  } catch (error: unknown) {
    results.fallbackDB = { status: 'Error', message: (error as Error).message };
  }

  return results;
};