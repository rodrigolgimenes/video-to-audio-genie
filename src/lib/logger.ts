
// Enhanced logger utility with detailed timestamps and categories

// Log categories for better organization
type LogCategory = 'INFO' | 'ERROR' | 'DEBUG' | 'WARN' | 'LAMEJS' | 'WORKER' | 'DATA' | 'PROCESS' | 'FORMAT' | 'VALIDATION';

export const log = (message: string, category: LogCategory = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.info(`${timestamp} ${category}: ${message}`);
};

export const error = (message: string) => {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp} ERROR: ${message}`);
};

export const debug = (message: string, data?: any, category: LogCategory = 'DEBUG') => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.debug(`${timestamp} ${category}: ${message}`, data);
  } else {
    console.debug(`${timestamp} ${category}: ${message}`);
  }
};

export const warn = (message: string) => {
  const timestamp = new Date().toISOString();
  console.warn(`${timestamp} WARN: ${message}`);
};

// Specialized loggers
export const logLameJS = (message: string) => {
  log(message, 'LAMEJS');
};

export const logWorker = (message: string) => {
  log(message, 'WORKER');
};

export const logData = (message: string) => {
  log(message, 'DATA');
};

export const logProcess = (message: string) => {
  log(message, 'PROCESS');
};

export const logFormat = (message: string) => {
  log(message, 'FORMAT');
};

export const logValidation = (message: string) => {
  log(message, 'VALIDATION');
};
