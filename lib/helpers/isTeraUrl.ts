export const isTeraboxUrl = (url: string): boolean => {
  return /^(https?:\/\/)?(www\.)?(terabox\.com|1024terabox\.com|teraboxlink\.com|teraboxapp\.xyz|terashare\.com)\//i.test(url);
};
