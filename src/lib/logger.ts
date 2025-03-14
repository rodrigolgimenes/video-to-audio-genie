
// Enhanced logger utility with detailed timestamps
export const log = (message: string) => {
  const timestamp = new Date().toISOString();
  console.info(`${timestamp} info: ${message}`);
};

export const error = (message: string) => {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp} error: ${message}`);
};

export const debug = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.debug(`${timestamp} debug: ${message}`, data);
  } else {
    console.debug(`${timestamp} debug: ${message}`);
  }
};

export const warn = (message: string) => {
  const timestamp = new Date().toISOString();
  console.warn(`${timestamp} warn: ${message}`);
};
