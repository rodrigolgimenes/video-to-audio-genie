
// Simple logger utility
export const log = (message: string) => {
  const timestamp = new Date().toISOString();
  console.info(`${timestamp} info: ${message}`);
};

export const error = (message: string) => {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp} error: ${message}`);
};
