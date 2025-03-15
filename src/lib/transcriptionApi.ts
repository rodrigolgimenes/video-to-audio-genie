
// This file is disabled because we're now using the real fast-whisper API directly

// The original fetch interceptor is disabled to avoid conflicts
if (typeof window !== 'undefined' && false) { // Set to false to disable
  const originalFetch = window.fetch;
  
  window.fetch = async function(input, init) {
    // All code here is disabled
    return originalFetch.apply(window, [input, init]);
  };
}
