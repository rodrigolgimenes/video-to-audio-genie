
// Enhanced logger utility with detailed timestamps, categories, and user-friendly messaging

// Log categories for better organization
export type LogCategory = 'INFO' | 'ERROR' | 'DEBUG' | 'WARN' | 'LAMEJS' | 'WORKER' | 'DATA' | 'PROCESS' | 'FORMAT' | 'VALIDATION' | 'USER' | 'CONVERTER';

// Global array to store all logs for access across components
let globalLogs: {message: string, category: LogCategory, timestamp: string}[] = [];

// Get all logs
export const getAllLogs = () => globalLogs;

// Clear all logs
export const clearLogs = () => {
  globalLogs = [];
};

// Base log function
export const log = (message: string, category: LogCategory = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.info(`${timestamp} ${category}: ${message}`);
  
  // Add to global logs
  globalLogs.push({
    message,
    category,
    timestamp
  });
  
  // Return formatted log message (useful for components that want to display it)
  return `${timestamp.split('T')[1].split('.')[0]} ${category}: ${message}`;
};

export const error = (message: string) => {
  const timestamp = new Date().toISOString();
  console.error(`${timestamp} ERROR: ${message}`);
  
  // Add to global logs
  globalLogs.push({
    message,
    category: 'ERROR',
    timestamp
  });
  
  return `${timestamp.split('T')[1].split('.')[0]} ERROR: ${message}`;
};

export const debug = (message: string, data?: any, category: LogCategory = 'DEBUG') => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.debug(`${timestamp} ${category}: ${message}`, data);
    
    // Add to global logs, stringify data if present
    globalLogs.push({
      message: `${message} ${data ? JSON.stringify(data, null, 2) : ''}`,
      category,
      timestamp
    });
  } else {
    console.debug(`${timestamp} ${category}: ${message}`);
    
    // Add to global logs
    globalLogs.push({
      message,
      category,
      timestamp
    });
  }
  
  return `${timestamp.split('T')[1].split('.')[0]} ${category}: ${message}`;
};

export const warn = (message: string) => {
  const timestamp = new Date().toISOString();
  console.warn(`${timestamp} WARN: ${message}`);
  
  // Add to global logs
  globalLogs.push({
    message,
    category: 'WARN',
    timestamp
  });
  
  return `${timestamp.split('T')[1].split('.')[0]} WARN: ${message}`;
};

// User-facing logs (more readable format for end users)
export const logUser = (message: string) => {
  const timestamp = new Date().toISOString();
  console.info(`${timestamp} USER: ${message}`);
  
  // Add to global logs
  globalLogs.push({
    message,
    category: 'USER',
    timestamp
  });
  
  return `${timestamp.split('T')[1].split('.')[0]} - ${message}`;
};

// Specialized loggers
export const logLameJS = (message: string) => {
  return log(message, 'LAMEJS');
};

export const logWorker = (message: string) => {
  return log(message, 'WORKER');
};

export const logData = (message: string) => {
  return log(message, 'DATA');
};

export const logProcess = (message: string) => {
  return log(message, 'PROCESS');
};

export const logFormat = (message: string) => {
  return log(message, 'FORMAT');
};

export const logValidation = (message: string) => {
  return log(message, 'VALIDATION');
};

export const logConverter = (message: string) => {
  return log(message, 'CONVERTER');
};

// Helper function to format logs for UI display
export const formatLogsForDisplay = () => {
  return globalLogs.map(log => {
    const time = log.timestamp.split('T')[1].split('.')[0];
    return `${time} ${log.category}: ${log.message}`;
  });
};

// Get logs by category
export const getLogsByCategory = (category: LogCategory) => {
  return globalLogs.filter(log => log.category === category);
};

// Get user-friendly logs (only USER category)
export const getUserLogs = () => {
  return globalLogs
    .filter(log => log.category === 'USER')
    .map(log => {
      const time = log.timestamp.split('T')[1].split('.')[0];
      return `${time} - ${log.message}`;
    });
};

// Get logs for specific tasks (filtered by patterns)
export const getTaskLogs = (taskPatterns: string[]) => {
  return globalLogs.filter(log => {
    return taskPatterns.some(pattern => log.message.includes(pattern));
  }).map(log => {
    const time = log.timestamp.split('T')[1].split('.')[0];
    return `${time} ${log.category}: ${log.message}`;
  });
};

// Filter logs by a search term
export const searchLogs = (term: string) => {
  if (!term) return [];
  
  return globalLogs.filter(log => 
    log.message.toLowerCase().includes(term.toLowerCase()) ||
    log.category.toLowerCase().includes(term.toLowerCase())
  ).map(log => {
    const time = log.timestamp.split('T')[1].split('.')[0];
    return `${time} ${log.category}: ${log.message}`;  
  });
};

