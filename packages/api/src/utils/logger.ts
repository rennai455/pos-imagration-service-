export const log = (msg: string, data?: any) =>
  console.log(`[${new Date().toISOString()}] ${msg}`, data || "");
