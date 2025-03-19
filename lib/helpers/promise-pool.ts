 export const runPromisePool = async <T>(tasks: Array<() => Promise<T>>, poolLimit: number): Promise<T[]> => {
   const results: T[] = [];
   let i = 0;
   const workers = new Array(poolLimit).fill(null).map(async function worker() {
     while (i < tasks.length) {
       const currentIndex = i;
       i++;
       results[currentIndex] = await tasks[currentIndex]();
     }
   });
   await Promise.all(workers);
   return results;
 };
