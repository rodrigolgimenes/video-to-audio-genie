
import { log } from './logger';

// AudioBuffer to WAV converter (only as fallback if MP3 conversion fails)
export function convertAudioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeUTFBytes(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  /* RIFF type format */
  writeUTFBytes(view, 8, 'WAVE');
  /* format chunk identifier */
  writeUTFBytes(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numberOfChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numberOfChannels * 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeUTFBytes(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, length * numberOfChannels * 2, true);

  floatTo16BitPCM(view, 44, audioBuffer);

  return buffer;
}

function writeUTFBytes(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(view: DataView, offset: number, audioBuffer: AudioBuffer) {
  const buffer = audioBuffer.getChannelData(0);
  const length = buffer.length;
  let index = offset;

  for (let i = 0; i < length; i++) {
    let sample = Math.max(-1, Math.min(1, buffer[i]));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(index, sample, true);
    index += 2;
  }
}

// MP3 encoding using Web Worker and lamejs
export async function convertAudioBufferToMp3(
  audioBuffer: AudioBuffer,
  quality: number = 128, // Default to 128kbps for smaller file size
  onProgress?: (percentage: number) => void
): Promise<{ buffer: ArrayBuffer; format: string }> {
  return new Promise((resolve, reject) => {
    try {
      log('Starting MP3 conversion process with quality ' + quality + 'kbps');
      
      // First convert to WAV for processing
      const wavBuffer = convertAudioBufferToWav(audioBuffer);
      
      // Get base URL for worker to properly load resources
      const baseUrl = window.location.origin;
      log(`Base URL for resources: ${baseUrl}`);
      
      // Create a worker with inline code - Fixed to avoid "Illegal return statement" error
      const workerCode = `
        // Worker for MP3 encoding using lamejs
        
        self.addEventListener('error', function(e) {
          console.error('Worker global error:', e.message);
          self.postMessage({ type: 'error', error: 'Worker error: ' + e.message });
        });

        console.log('Worker: Starting to load lamejs library...');
        
        // Variable to track lamejs loading state
        let lameLoaded = false;
        let lameGlobal = null;
        
        try {
          // Use full URL path to ensure the worker can find the library
          const lameJsUrl = '${baseUrl}/libs/lamejs/lame.all.js';
          console.log('Worker: Attempting to load lamejs from ' + lameJsUrl);
          self.postMessage({ type: 'log', message: 'Worker: Attempting to load lamejs from ' + lameJsUrl });
          
          importScripts(lameJsUrl);
          
          // Check if lamejs is actually loaded
          if (typeof self.lamejs === 'undefined') {
            console.error('Worker: lamejs was not defined after importScripts!');
            self.postMessage({ 
              type: 'log', 
              message: 'LAMEJS CHECK: lamejs was not defined after importScripts'
            });
            throw new Error('lamejs was not defined after importScripts');
          }
          
          lameGlobal = self.lamejs;
          console.log('Worker: lamejs library loaded successfully', typeof self.lamejs);
          console.log('Worker: lamejs Mp3Encoder available:', typeof self.lamejs.Mp3Encoder);
          
          // ENHANCED LOGGING: Detailed structure of lamejs object
          const lameProps = Object.keys(self.lamejs);
          self.postMessage({ 
            type: 'log', 
            message: 'LAMEJS STRUCTURE: Available properties: ' + lameProps.join(', ')
          });
          
          // ENHANCED LOGGING: Check if Mp3Encoder is a constructor
          if (typeof self.lamejs.Mp3Encoder === 'function') {
            self.postMessage({ 
              type: 'log', 
              message: 'LAMEJS Mp3Encoder is a function and can be instantiated with new'
            });
          } else {
            self.postMessage({ 
              type: 'log', 
              message: 'LAMEJS WARNING: Mp3Encoder is type ' + typeof self.lamejs.Mp3Encoder + ' (should be function)'
            });
          }
          
          // ENHANCED LOGGING: Check internal structure of Mp3Encoder prototype
          try {
            const protoProps = Object.getOwnPropertyNames(self.lamejs.Mp3Encoder.prototype);
            self.postMessage({ 
              type: 'log', 
              message: 'LAMEJS Mp3Encoder prototype methods: ' + protoProps.join(', ')
            });
          } catch (e) {
            self.postMessage({ 
              type: 'log', 
              message: 'LAMEJS WARNING: Could not inspect Mp3Encoder prototype: ' + e.message
            });
          }
          
          self.postMessage({ 
            type: 'log', 
            message: 'LAMEJS CHECK: Library loaded. Type: ' + typeof self.lamejs + ', Mp3Encoder: ' + typeof self.lamejs.Mp3Encoder
          });
          lameLoaded = true;
        } catch (e) {
          console.error('Worker: Failed to load lamejs library:', e);
          console.error('Worker: Error details:', e.stack || 'No stack trace');
          self.postMessage({ 
            type: 'log', 
            message: 'LAMEJS CHECK FAILED: ' + e.message
          });
          self.postMessage({ 
            type: 'error', 
            error: 'Failed to load MP3 encoder library: ' + e.message,
            details: e.stack || 'No stack trace'
          });
        }

        self.onmessage = function(e) {
          try {
            const { wavBuffer, channels, sampleRate, quality } = e.data;
            
            console.log('Worker: Starting MP3 encoding with ' + quality + 'kbps quality');
            self.postMessage({ 
              type: 'log', 
              message: 'Worker received data: ' + channels + ' channels, ' + sampleRate + 'Hz, ' + quality + 'kbps, buffer size: ' + wavBuffer.byteLength 
            });
            
            if (!lameLoaded || !lameGlobal) {
              self.postMessage({ 
                type: 'log', 
                message: 'LAMEJS GLOBAL CHECK: lameLoaded=' + lameLoaded + ', lameGlobal=' + (lameGlobal ? 'exists' : 'null')
              });
              throw new Error('Cannot encode MP3: lamejs library not loaded');
            }
            
            // Create MP3 encoder
            console.log('Worker: Creating Mp3Encoder instance');
            self.postMessage({ 
              type: 'log', 
              message: 'About to create Mp3Encoder with: ' + channels + ', ' + sampleRate + ', ' + quality 
            });
            
            // Explicitly check Mp3Encoder
            if (typeof lameGlobal.Mp3Encoder !== 'function') {
              self.postMessage({ 
                type: 'log', 
                message: 'CRITICAL ERROR: Mp3Encoder is not a function, type=' + typeof lameGlobal.Mp3Encoder
              });
              throw new Error('Mp3Encoder is not a constructor: ' + typeof lameGlobal.Mp3Encoder);
            }
            
            // Create encoder and report
            const mp3encoder = new lameGlobal.Mp3Encoder(channels, sampleRate, quality);
            self.postMessage({ 
              type: 'log', 
              message: 'Mp3Encoder created: ' + (mp3encoder ? 'Success' : 'Failed')
            });
            
            // ENHANCED LOGGING: Check encoder instance properties
            try {
              const encoderProps = Object.keys(mp3encoder);
              self.postMessage({ 
                type: 'log', 
                message: 'ENCODER INSTANCE: Properties: ' + encoderProps.join(', ')
              });
              
              if (typeof mp3encoder.encodeBuffer !== 'function') {
                self.postMessage({ 
                  type: 'log', 
                  message: 'CRITICAL ERROR: mp3encoder.encodeBuffer is not a function: ' + typeof mp3encoder.encodeBuffer
                });
              }
              
              if (typeof mp3encoder.flush !== 'function') {
                self.postMessage({ 
                  type: 'log', 
                  message: 'CRITICAL ERROR: mp3encoder.flush is not a function: ' + typeof mp3encoder.flush
                });
              }
            } catch (encErr) {
              self.postMessage({ 
                type: 'log', 
                message: 'ERROR inspecting encoder: ' + encErr.message
              });
            }
            
            // Get WAV samples and convert them
            self.postMessage({ 
              type: 'log', 
              message: 'Encoding progress: Starting actual encoding of MP3 data'
            });
            
            // Get WAV samples as float32, we need to convert to int16
            const wavBytes = new Uint8Array(wavBuffer);
            
            // ENHANCED LOGGING: Log WAV header information
            self.postMessage({ 
              type: 'log', 
              message: 'WAV HEADER: First 44 bytes: ' + Array.from(wavBytes.slice(0, 44)).join(',')
            });
            
            // Skip WAV header - find the data section
            let dataStartIndex = 0;
            for (let i = 0; i < wavBytes.length - 4; i++) {
              if (wavBytes[i] === 100 && wavBytes[i+1] === 97 && wavBytes[i+2] === 116 && wavBytes[i+3] === 97) {
                // 'data' chunk found, skip the identifier and chunk size (8 bytes)
                dataStartIndex = i + 8;
                console.log('Worker: Found data chunk at index', i, 'data starts at', dataStartIndex);
                self.postMessage({ 
                  type: 'log', 
                  message: 'WAV FORMAT: Found data chunk at byte ' + i + ', data starts at byte ' + dataStartIndex
                });
                break;
              }
            }
            
            if (dataStartIndex === 0) {
              throw new Error('Could not find data chunk in WAV file');
            }
            
            // Get samples from WAV
            const samples = new Int16Array((wavBytes.length - dataStartIndex) / 2);
            
            // ENHANCED LOGGING: Log sample range information
            self.postMessage({ 
              type: 'log', 
              message: 'WAV DATA: Sample array size: ' + samples.length
            });
            
            // Extract samples data
            for (let i = 0; i < samples.length; i++) {
              const idx = dataStartIndex + (i * 2);
              samples[i] = (wavBytes[idx] | (wavBytes[idx + 1] << 8));
              
              // Log some sample values for debugging (only log a few to avoid flooding)
              if (i < 10 || i % 10000 === 0) {
                self.postMessage({ 
                  type: 'log', 
                  message: 'SAMPLE DATA: samples[' + i + '] = ' + samples[i] + ' (from bytes at index ' + idx + ')'
                });
              }
            }
            
            // ENHANCED LOGGING: Log samples min/max
            let minSample = 32767;
            let maxSample = -32768;
            for (let i = 0; i < Math.min(1000, samples.length); i++) {
              if (samples[i] < minSample) minSample = samples[i];
              if (samples[i] > maxSample) maxSample = samples[i];
            }
            self.postMessage({ 
              type: 'log', 
              message: 'SAMPLE RANGE: Min=' + minSample + ', Max=' + maxSample + ' (first 1000 samples)'
            });
            
            console.log('Worker: Extracted', samples.length, 'samples from WAV');
            self.postMessage({ type: 'log', message: 'Extracted ' + samples.length + ' samples from WAV' });
            
            const blockSize = 1152; // MPEG1 Layer 3 requires 1152 samples per frame
            self.postMessage({ 
              type: 'log', 
              message: 'PROCESSING: Using blockSize=' + blockSize + ' for MP3 frames'
            });
            
            const mp3Data = [];
            
            // Get left and right channels
            const left = new Int16Array(blockSize);
            const right = channels > 1 ? new Int16Array(blockSize) : null;
            
            const totalBlocks = Math.ceil(samples.length / (channels * blockSize));
            console.log('Worker: Processing', totalBlocks, 'blocks');
            self.postMessage({ 
              type: 'log', 
              message: 'PROCESSING: Total blocks to process: ' + totalBlocks
            });
            
            // Before encoding, let's check if the encoder works
            try {
              // Test encode a very small block
              const testLeft = new Int16Array(blockSize);
              testLeft.fill(0); // Use zeros for test
              
              // ENHANCED LOGGING: log test data
              self.postMessage({ 
                type: 'log', 
                message: 'TEST DATA: First 5 values: ' + Array.from(testLeft.slice(0, 5)).join(',')
              });
              
              const testMp3 = mp3encoder.encodeBuffer(testLeft);
              self.postMessage({ 
                type: 'log', 
                message: 'TEST ENCODE SUCCESSFUL: buffer length=' + testMp3.length
              });
            } catch (testError) {
              self.postMessage({ 
                type: 'log', 
                message: 'TEST ENCODE FAILED: ' + testError.message + ', stack: ' + testError.stack
              });
              throw testError;
            }
            
            for (let i = 0; i < totalBlocks; i++) {
              // ENHANCED LOGGING: Block processing details
              const offset = i * channels * blockSize;
              const remaining = Math.min(blockSize, (samples.length - offset) / channels);
              
              if (i === 0 || i === totalBlocks - 1 || i % 50 === 0) {
                self.postMessage({ 
                  type: 'log', 
                  message: 'BLOCK PROCESSING: Block ' + i + '/' + totalBlocks + 
                            ', offset=' + offset + 
                            ', remaining samples=' + remaining
                });
              }
              
              // Clear arrays
              left.fill(0);
              if (right) right.fill(0);
              
              // Extract channel data
              for (let j = 0; j < remaining; j++) {
                if (channels > 1) {
                  // Stereo
                  if (offset + (j * 2) < samples.length) {
                    left[j] = samples[offset + (j * 2)];
                    
                    // ENHANCED LOGGING: Check index bounds for right channel
                    if (offset + (j * 2) + 1 >= samples.length) {
                      self.postMessage({ 
                        type: 'log', 
                        message: 'INDEX ERROR: Right channel index out of bounds: offset=' + offset + 
                                  ', j=' + j + 
                                  ', trying to access index ' + (offset + (j * 2) + 1) + 
                                  ' in array of length ' + samples.length
                      });
                      // Fix: use zero instead of accessing out of bounds
                      right[j] = 0;
                    } else {
                      right[j] = samples[offset + (j * 2) + 1];
                    }
                  } else {
                    // Out of bounds for left channel
                    self.postMessage({ 
                      type: 'log', 
                      message: 'INDEX ERROR: Left channel index out of bounds: offset=' + offset + 
                                ', j=' + j + 
                                ', trying to access index ' + (offset + (j * 2)) + 
                                ' in array of length ' + samples.length
                    });
                    // Fix: use zeros instead of accessing out of bounds
                    left[j] = 0;
                    right[j] = 0;
                  }
                } else {
                  // Mono
                  if (offset + j < samples.length) {
                    left[j] = samples[offset + j];
                  } else {
                    // Out of bounds
                    self.postMessage({ 
                      type: 'log', 
                      message: 'INDEX ERROR: Mono channel index out of bounds: offset=' + offset + 
                                ', j=' + j + 
                                ', trying to access index ' + (offset + j) + 
                                ' in array of length ' + samples.length
                    });
                    // Fix: use zero instead of accessing out of bounds
                    left[j] = 0;
                  }
                }
                
                // Log a few sample values for the first block
                if (i === 0 && j < 5) {
                  if (channels > 1) {
                    self.postMessage({ 
                      type: 'log', 
                      message: 'CHANNEL DATA: Block 0, Sample ' + j + 
                                ', left=' + left[j] + 
                                ', right=' + right[j]
                    });
                  } else {
                    self.postMessage({ 
                      type: 'log', 
                      message: 'CHANNEL DATA: Block 0, Sample ' + j + 
                                ', mono=' + left[j]
                    });
                  }
                }
              }
              
              // ENHANCED LOGGING: Check audio data range for this block
              if (i === 0 || i % 50 === 0) {
                let blockMinLeft = 32767;
                let blockMaxLeft = -32768;
                let blockMinRight = channels > 1 ? 32767 : 0;
                let blockMaxRight = channels > 1 ? -32768 : 0;
                
                for (let j = 0; j < remaining; j++) {
                  if (left[j] < blockMinLeft) blockMinLeft = left[j];
                  if (left[j] > blockMaxLeft) blockMaxLeft = left[j];
                  if (channels > 1) {
                    if (right[j] < blockMinRight) blockMinRight = right[j];
                    if (right[j] > blockMaxRight) blockMaxRight = right[j];
                  }
                }
                
                if (channels > 1) {
                  self.postMessage({ 
                    type: 'log', 
                    message: 'BLOCK DATA RANGE: Block ' + i + 
                              ', Left min=' + blockMinLeft + 
                              ', max=' + blockMaxLeft + 
                              ', Right min=' + blockMinRight + 
                              ', max=' + blockMaxRight + 
                              ', remaining=' + remaining
                  });
                } else {
                  self.postMessage({ 
                    type: 'log', 
                    message: 'BLOCK DATA RANGE: Block ' + i + 
                              ', Mono min=' + blockMinLeft + 
                              ', max=' + blockMaxLeft + 
                              ', remaining=' + remaining
                  });
                }
              }
              
              // Encode frame with try/catch to get detailed error logging
              try {
                let mp3buf;
                if (channels > 1) {
                  mp3buf = mp3encoder.encodeBuffer(left, right);
                } else {
                  mp3buf = mp3encoder.encodeBuffer(left);
                }
                
                if (mp3buf && mp3buf.length > 0) {
                  mp3Data.push(mp3buf);
                  if (i === 0) {
                    self.postMessage({ 
                      type: 'log', 
                      message: 'First encode block successful: ' + mp3buf.length + ' bytes'
                    });
                  }
                } else if (i === 0) {
                  self.postMessage({ 
                    type: 'log', 
                    message: 'WARNING: First encode block returned empty buffer'
                  });
                }
              } catch (encodeError) {
                // Detailed encode error logging
                self.postMessage({ 
                  type: 'log', 
                  message: 'ENCODE ERROR in block ' + i + ': ' + encodeError.message + 
                            '\\nStack: ' + encodeError.stack + 
                            '\\nLeft buffer first 5 values: ' + Array.from(left.slice(0, 5)).join(',') + 
                            (channels > 1 ? '\\nRight buffer first 5 values: ' + Array.from(right.slice(0, 5)).join(',') : '')
                });
                throw encodeError;
              }
              
              // Report progress
              if (i % 10 === 0 || i === totalBlocks - 1) {
                const progress = Math.min(100, Math.round((i / totalBlocks) * 100));
                self.postMessage({ type: 'progress', progress });
              }
            }
            
            // Finalize
            console.log('Worker: Finalizing MP3 encoding');
            self.postMessage({ type: 'log', message: 'Finalizing MP3 encoding with flush()' });
            
            // Call flush() with try/catch for detailed error logging
            let finalMp3buf;
            try {
              finalMp3buf = mp3encoder.flush();
              
              if (finalMp3buf && finalMp3buf.length > 0) {
                mp3Data.push(finalMp3buf);
                self.postMessage({ 
                  type: 'log', 
                  message: 'Flush successful: ' + finalMp3buf.length + ' bytes'
                });
              } else {
                self.postMessage({ 
                  type: 'log', 
                  message: 'WARNING: Flush returned empty buffer'
                });
              }
            } catch (flushError) {
              self.postMessage({ 
                type: 'log', 
                message: 'FLUSH ERROR: ' + flushError.message + '\\nStack: ' + flushError.stack
              });
              throw flushError;
            }
            
            // Combine all chunks
            let totalLength = 0;
            for (let i = 0; i < mp3Data.length; i++) {
              totalLength += mp3Data[i].length;
            }
            
            if (totalLength === 0) {
              self.postMessage({ 
                type: 'log', 
                message: 'ERROR: No MP3 data generated (totalLength=0)'
              });
              throw new Error('No MP3 data generated (buffer length is 0)');
            }
            
            const mp3Buffer = new Uint8Array(totalLength);
            let offset = 0;
            for (let i = 0; i < mp3Data.length; i++) {
              mp3Buffer.set(mp3Data[i], offset);
              offset += mp3Data[i].length;
            }
            
            console.log('Worker: MP3 encoding complete, size: ' + mp3Buffer.length + ' bytes');
            self.postMessage({ 
              type: 'log', 
              message: 'MP3 encoding complete: ' + mp3Buffer.length + ' bytes'
            });
            self.postMessage({ 
              type: 'complete', 
              buffer: mp3Buffer.buffer,
              size: mp3Buffer.length
            }, [mp3Buffer.buffer]);
          } catch (err) {
            console.error('Worker: MP3 encoding error:', err);
            console.error('Worker: Error stack:', err.stack || 'No stack trace');
            self.postMessage({ 
              type: 'log', 
              message: 'ERROR IN WORKER: ' + err.message + (err.stack ? '\\nStack: ' + err.stack : '')
            });
            self.postMessage({ 
              type: 'error', 
              error: 'MP3 encoding failed: ' + err.message,
              details: err.stack || 'No stack trace'
            });
          }
        };
      `;
      
      // Create the worker
      const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(workerBlob);
      const worker = new Worker(workerUrl); // Use classic worker mode, not module

      log('Worker created and started');
      
      // Error timeout (30 seconds)
      const errorTimeout = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        reject(new Error('MP3 conversion timed out after 30 seconds'));
      }, 30000);
      
      // Handle worker messages
      worker.onmessage = (e) => {
        const { type, progress, buffer, error, details, size, message } = e.data;
        
        if (type === 'log' && message) {
          log(`WORKER LOG: ${message}`);
        } else if (type === 'progress' && onProgress) {
          onProgress(progress);
        } else if (type === 'complete') {
          clearTimeout(errorTimeout);
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          
          log(`MP3 conversion complete: ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB)`);
          resolve({ 
            buffer: buffer, 
            format: 'audio/mpeg' 
          });
        } else if (type === 'error') {
          clearTimeout(errorTimeout);
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          log(`Worker error: ${error}${details ? '\nDetails: ' + details : ''}`);
          reject(new Error(error + (details ? '\nDetails: ' + details : '')));
        }
      };
      
      // Handle worker errors
      worker.onerror = (err) => {
        clearTimeout(errorTimeout);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        log(`Worker error: ${err.message}`);
        reject(new Error(`Conversion failed: ${err.message}`));
      };
      
      // Start the conversion
      log(`Starting audio conversion: channels=${audioBuffer.numberOfChannels}, sampleRate=${audioBuffer.sampleRate}, wavBuffer size=${wavBuffer.byteLength}, quality=${quality}kbps`);
      worker.postMessage({
        wavBuffer,
        channels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
        quality
      }, [wavBuffer]);
      
      log('WAV data sent to worker for processing');
    } catch (error) {
      log(`Error starting conversion: ${(error as Error).message}`);
      reject(error);
    }
  });
}

// Create logger function
export function createLogger(addLog: (message: string) => void): (message: string) => void {
  return (message: string) => {
    console.log(message);
    addLog(message);
  };
}
