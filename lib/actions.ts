'use server';
import { testDatabaseConnection } from '@/service/postgres';
import { testStorageConnection } from '@/service/s3-tebi';


const scanForError = (
  shouldCheck: boolean,
  promise: () => Promise<any>
): Promise<string> =>
  shouldCheck
    ? promise()
      .then(() => '')
      .catch(error => error.message)
    : Promise.resolve('');

export const runAuthenticatedAdminServerAction = async <T>(
  callback: () => T,
): Promise<T> => {
  // const session = await auth();
  // if (session?.user)
  {
    return callback();
  }
}

export const testConnectionsAction = async () =>
  runAuthenticatedAdminServerAction(async () => {

    const [
      databaseError,
      storageError,
      // kvError,
      // aiError,
    ] = await Promise.all([
      scanForError(true, testDatabaseConnection),
      scanForError( true, testStorageConnection),
      // scanForError(hasVercelKv, testKvConnection),
      // scanForError(isAiTextGenerationEnabled, testOpenAiConnection),
    ]);
    console.log({ databaseError, storageError })
    return {
      databaseError,
      storageError,
      // kvError,
      // aiError,
    };
  });
