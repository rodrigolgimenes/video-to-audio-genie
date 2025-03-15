
import { log, logLameJS, logWorker, logData, logFormat, logValidation } from './logger';

// AudioBuffer to WAV converter (only as fallback if MP3 conversion fails)
export function convertAudioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  logFormat(`Creating WAV with ${numberOfChannels} channels, ${sampleRate}Hz, ${length} samples`);

  // Validate audio data
  if (length === 0) {
    throw new Error("Cannot create WAV: AudioBuffer has no samples");
  }

  if (numberOfChannels <= 0) {
    throw new Error(`Invalid number of channels: ${numberOfChannels}`);
  }

  // Create WAV buffer with proper header
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

  logFormat(`WAV header created: RIFF/WAVE format, data size: ${length * numberOfChannels * 2} bytes`);

  // Convert float audio data to PCM
  floatTo16BitPCM(view, 44, audioBuffer);

  // Validate WAV header
  const headerValidation = validateWavHeader(view);
  if (!headerValidation.valid) {
    logValidation(`WARNING: WAV header validation issue: ${headerValidation.message}`);
  } else {
    logValidation(`WAV header validation passed`);
  }

  return buffer;
}

function validateWavHeader(view: DataView): { valid: boolean; message?: string } {
  // Read the magic bytes to confirm RIFF/WAVE format
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  
  if (riff !== 'RIFF') return { valid: false, message: `Expected 'RIFF', got '${riff}'` };
  if (wave !== 'WAVE') return { valid: false, message: `Expected 'WAVE', got '${wave}'` };
  
  const audioFormat = view.getUint16(20, true);
  if (audioFormat !== 1) return { valid: false, message: `Expected PCM format (1), got ${audioFormat}` };
  
  return { valid: true };
}

function writeUTFBytes(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(view: DataView, offset: number, audioBuffer: AudioBuffer) {
  logData(`Converting float audio data to 16-bit PCM, channels: ${audioBuffer.numberOfChannels}`);
  const numChannels = audioBuffer.numberOfChannels;
  
  // Process each channel
  for (let c = 0; c < numChannels; c++) {
    const channelData = audioBuffer.getChannelData(c);
    logData(`Channel ${c} data length: ${channelData.length}, min/max check on first 100 samples`);
    
    // Get min/max values for debug
    let min = 1.0, max = -1.0;
    for (let i = 0; i < Math.min(100, channelData.length); i++) {
      min = Math.min(min, channelData[i]);
      max = Math.max(max, channelData[i]);
    }
    logData(`Channel ${c} sample range (first 100): min=${min}, max=${max}`);
  }

  // Interleave channel data
  let index = offset;
  const length = audioBuffer.length;
  
  // Single or multi-channel data processing
  if (numChannels === 1) {
    // Mono case - simpler process
    const buffer = audioBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      // Clamp value to [-1,1] range, then convert to 16-bit
      let sample = Math.max(-1, Math.min(1, buffer[i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF; // Convert to 16-bit
      view.setInt16(index, sample, true);
      index += 2;
    }
  } else {
    // Multi-channel - interleaved format
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numChannels; c++) {
        const buffer = audioBuffer.getChannelData(c);
        // Clamp value to [-1,1] range, then convert to 16-bit
        let sample = Math.max(-1, Math.min(1, buffer[i]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF; // Convert to 16-bit
        view.setInt16(index, sample, true);
        index += 2;
      }
    }
  }
  
  logData(`PCM conversion complete, total bytes written: ${index - offset}`);
}

// MP3 encoding using Web Worker and lamejs
export async function convertAudioBufferToMp3(
  audioBuffer: AudioBuffer,
  quality: number = 128, // Default to 128kbps for smaller file size
  onProgress?: (percentage: number) => void
): Promise<{ buffer: ArrayBuffer; format: string }> {
  return new Promise((resolve, reject) => {
    try {
      logLameJS('Starting MP3 conversion process with quality ' + quality + 'kbps');
      
      // Validate input
      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error("Invalid AudioBuffer: empty or null");
      }
      
      if (audioBuffer.numberOfChannels > 2) {
        logValidation(`WARNING: Audio has ${audioBuffer.numberOfChannels} channels, but MP3 only supports 1 or 2. Will use first two channels.`);
      }
      
      // First convert to WAV for processing
      const wavBuffer = convertAudioBufferToWav(audioBuffer);
      
      // Get base URL for worker to properly load resources
      const baseUrl = window.location.origin;
      logWorker(`Base URL for resources: ${baseUrl}`);
      
      // Create a worker with inline code - Fixed syntax error in the worker code
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
          
          // Detailed inspection of lame object
          self.postMessage({ 
            type: 'log', 
            message: 'LAMEJS VERSION: ' + (self.lamejs.version || 'unknown')
          });
          
          // ENHANCED LOGGING: Check if Mp3Encoder is a constructor
          if (typeof self.lamejs.Mp3Encoder === 'function') {
            self.postMessage({ 
              type: 'log', 
              message: 'LAMEJS Mp3Encoder is a function and can be instantiated with new'
            });
            
            // Check if it's named properly
            if (self.lamejs.Mp3Encoder.name !== 'Mp3Encoder') {
              self.postMessage({ 
                type: 'log', 
                message: 'WARNING: Mp3Encoder has unexpected name: ' + self.lamejs.Mp3Encoder.name
              });
            }
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
            
            // Check specifically for encodeBuffer and flush
            if (protoProps.includes('encodeBuffer') && protoProps.includes('flush')) {
              self.postMessage({ 
                type: 'log', 
                message: 'LAMEJS Mp3Encoder has required methods: encodeBuffer and flush'
              });
            } else {
              self.postMessage({ 
                type: 'log', 
                message: 'CRITICAL: Mp3Encoder missing required methods!'
              });
            }
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
          
          // Try creating a test encoder instance
          try {
            const testEncoder = new self.lamejs.Mp3Encoder(1, 44100, 64);
            self.postMessage({ 
              type: 'log', 
              message: 'Test Mp3Encoder created successfully: ' + typeof testEncoder
            });
            
            // Test if the encoder has the expected methods
            if (typeof testEncoder.encodeBuffer === 'function') {
              self.postMessage({ 
                type: 'log', 
                message: 'Test Mp3Encoder.encodeBuffer is a function'
              });
            } else {
              self.postMessage({ 
                type: 'log', 
                message: 'WARNING: Test Mp3Encoder.encodeBuffer is not a function: ' + typeof testEncoder.encodeBuffer
              });
            }
          } catch (testErr) {
            self.postMessage({ 
              type: 'log', 
              message: 'ERROR creating test Mp3Encoder: ' + testErr.message
            });
          }
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
            
            // Validate inputs
            if (!wavBuffer || wavBuffer.byteLength === 0) {
              throw new Error('Invalid WAV buffer: empty or null');
            }
            
            if (channels !== 1 && channels !== 2) {
              throw new Error('Invalid channels: MP3 only supports 1 or 2 channels, got ' + channels);
            }
            
            if (sampleRate <= 0) {
              throw new Error('Invalid sample rate: ' + sampleRate);
            }
            
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
                throw new Error('encodeBuffer is not a function on Mp3Encoder instance');
              }
              
              if (typeof mp3encoder.flush !== 'function') {
                self.postMessage({ 
                  type: 'log', 
                  message: 'CRITICAL ERROR: mp3encoder.flush is not a function: ' + typeof mp3encoder.flush
                });
                throw new Error('flush is not a function on Mp3Encoder instance');
              }
            } catch (encErr) {
              self.postMessage({ 
                type: 'log', 
                message: 'ERROR inspecting encoder: ' + encErr.message
              });
              throw encErr;
            }
            
            // Get WAV samples and convert them
            self.postMessage({ 
              type: 'log', 
              message: 'Encoding progress: Starting actual encoding of MP3 data'
            });
            
            // Get WAV samples as float32, we need to convert to int16
            const wavBytes = new Uint8Array(wavBuffer);
            
            // Validate WAV format before processing
            if (wavBytes.length < 44) {
              throw new Error('Invalid WAV file: too small, missing header');
            }
            
            // Parse and validate WAV header
            function validateWavFormat() {
              // Check RIFF header
              const riff = String.fromCharCode(wavBytes[0], wavBytes[1], wavBytes[2], wavBytes[3]);
              if (riff !== 'RIFF') {
                throw new Error('Invalid WAV format: missing RIFF marker');
              }
              
              // Check WAVE format
              const wave = String.fromCharCode(wavBytes[8], wavBytes[9], wavBytes[10], wavBytes[11]);
              if (wave !== 'WAVE') {
                throw new Error('Invalid WAV format: missing WAVE marker');
              }
              
              // Look for data chunk
              let dataChunkPos = 0;
              for (let i = 12; i < wavBytes.length - 8; i++) {
                if (wavBytes[i] === 100 && wavBytes[i+1] === 97 && 
                    wavBytes[i+2] === 116 && wavBytes[i+3] === 97) { // "data"
                  dataChunkPos = i;
                  break;
                }
              }
              
              if (dataChunkPos === 0) {
                throw new Error('Invalid WAV format: cannot find data chunk');
              }
              
              // Get data chunk size
              const dataView = new DataView(wavBuffer);
              const dataSize = dataView.getUint32(dataChunkPos + 4, true);
              
              return {
                dataPos: dataChunkPos + 8, // Skip "data" + size
                dataSize: dataSize,
                format: dataView.getUint16(20, true), // Audio format (1 = PCM)
                channels: dataView.getUint16(22, true), // Number of channels
                sampleRate: dataView.getUint32(24, true), // Sample rate
                bitsPerSample: dataView.getUint16(34, true) // Bits per sample
              };
            }
            
            // Validate WAV format
            const wavFormat = validateWavFormat();
            self.postMessage({ 
              type: 'log', 
              message: 'WAV FORMAT: ' + JSON.stringify(wavFormat)
            });
            
            // Verify WAV format matches expected
            if (wavFormat.format !== 1) {
              throw new Error('Unsupported WAV format: ' + wavFormat.format + ', expected PCM (1)');
            }
            
            if (wavFormat.channels !== channels) {
              self.postMessage({ 
                type: 'log', 
                message: 'WARNING: WAV channels (' + wavFormat.channels + 
                          ') doesn\\'t match expected channels (' + channels + ')'
              });
            }
            
            if (wavFormat.sampleRate !== sampleRate) {
              self.postMessage({ 
                type: 'log', 
                message: 'WARNING: WAV sample rate (' + wavFormat.sampleRate + 
                          ') doesn\\'t match expected sample rate (' + sampleRate + ')'
              });
            }
            
            if (wavFormat.bitsPerSample !== 16) {
              throw new Error('Unsupported bits per sample: ' + wavFormat.bitsPerSample + ', expected 16-bit');
            }
            
            const dataStartIndex = wavFormat.dataPos;
            self.postMessage({ 
              type: 'log', 
              message: 'WAV FORMAT: Found data chunk at byte ' + (dataStartIndex - 8) + 
                        ', data starts at byte ' + dataStartIndex + 
                        ', data size: ' + wavFormat.dataSize + ' bytes'
            });
            
            // Calculate how many samples we should have
            const samplesPerChannel = Math.floor(wavFormat.dataSize / (wavFormat.channels * (wavFormat.bitsPerSample / 8)));
            self.postMessage({ 
              type: 'log', 
              message: 'WAV DATA: Expecting ' + samplesPerChannel + ' samples per channel'
            });
            
            // Get samples from WAV - extract 16-bit PCM data
            // Each sample is 2 bytes (16-bit)
            // For stereo: [LEFT_0, RIGHT_0, LEFT_1, RIGHT_1, ...]
            // For mono: [SAMPLE_0, SAMPLE_1, SAMPLE_2, ...]
            const bytesPerSample = wavFormat.bitsPerSample / 8;
            const bytesPerFrame = bytesPerSample * wavFormat.channels;
            
            // Create arrays for each channel
            let leftChannel = new Int16Array(samplesPerChannel);
            let rightChannel = (channels > 1) ? new Int16Array(samplesPerChannel) : null;
            
            self.postMessage({ 
              type: 'log', 
              message: 'Extracting audio data (' + channels + ' channels, ' + 
                        bytesPerSample + ' bytes per sample, ' + 
                        bytesPerFrame + ' bytes per frame)'
            });
            
            let errors = 0;
            // Extract the samples - correctly handle interleaved data
            for (let i = 0; i < samplesPerChannel; i++) {
              // Calculate byte position for this sample frame
              const frameStart = dataStartIndex + (i * bytesPerFrame);
              
              if (frameStart + bytesPerFrame > wavBytes.length) {
                self.postMessage({ 
                  type: 'log', 
                  message: 'ERROR: Buffer overrun at sample ' + i + 
                            ' (index ' + frameStart + ' + ' + bytesPerFrame + 
                            ' exceeds buffer size ' + wavBytes.length + ')'
                });
                errors++;
                // Break if we have too many errors
                if (errors > 10) {
                  throw new Error('Too many errors accessing WAV data');
                }
                continue;
              }
              
              // Get left channel (or mono)
              leftChannel[i] = (wavBytes[frameStart] | (wavBytes[frameStart + 1] << 8));
              
              // Get right channel in stereo case
              if (channels > 1 && rightChannel) {
                rightChannel[i] = (wavBytes[frameStart + 2] | (wavBytes[frameStart + 3] << 8));
              }
              
              // Log a few samples for debugging
              if (i === 0 || i === 100 || i === 1000 || i === 10000) {
                if (channels > 1 && rightChannel) {
                  self.postMessage({ 
                    type: 'log', 
                    message: 'SAMPLE[' + i + ']: Left=' + leftChannel[i] + 
                              ', Right=' + rightChannel[i] + 
                              ' (from bytes at ' + frameStart + ')'
                  });
                } else {
                  self.postMessage({ 
                    type: 'log', 
                    message: 'SAMPLE[' + i + ']: Mono=' + leftChannel[i] + 
                              ' (from bytes at ' + frameStart + ')'
                  });
                }
              }
            }
            
            // Check value ranges
            let minLeft = 32767, maxLeft = -32768;
            let minRight = 32767, maxRight = -32768;
            
            for (let i = 0; i < Math.min(1000, samplesPerChannel); i++) {
              minLeft = Math.min(minLeft, leftChannel[i]);
              maxLeft = Math.max(maxLeft, leftChannel[i]);
              
              if (channels > 1 && rightChannel) {
                minRight = Math.min(minRight, rightChannel[i]);
                maxRight = Math.max(maxRight, rightChannel[i]);
              }
            }
            
            // Report range stats
            if (channels > 1 && rightChannel) {
              self.postMessage({ 
                type: 'log', 
                message: 'SAMPLE RANGES (first 1000): Left min=' + minLeft + 
                          ', max=' + maxLeft + ', Right min=' + minRight + 
                          ', max=' + maxRight
              });
            } else {
              self.postMessage({ 
                type: 'log', 
                message: 'SAMPLE RANGES (first 1000): Mono min=' + minLeft + 
                          ', max=' + maxLeft
              });
            }
            
            // Now we have our channel data correctly separated
            // Process in chunks for MP3 encoding
            const blockSize = 1152; // MPEG1 Layer 3 samples per frame
            const totalBlocks = Math.ceil(samplesPerChannel / blockSize);
            
            self.postMessage({ 
              type: 'log', 
              message: 'MP3 ENCODING: Processing ' + samplesPerChannel + 
                        ' samples in ' + totalBlocks + ' blocks of ' + blockSize
            });
            
            // First do a test encode to verify the encoder works
            try {
              // Test small sample block
              const testLeft = new Int16Array(blockSize);
              testLeft.fill(0);
              
              let testResult;
              if (channels > 1 && rightChannel) {
                const testRight = new Int16Array(blockSize);
                testRight.fill(0);
                testResult = mp3encoder.encodeBuffer(testLeft, testRight);
              } else {
                testResult = mp3encoder.encodeBuffer(testLeft);
              }
              
              self.postMessage({ 
                type: 'log', 
                message: 'TEST ENCODE: Success, output size: ' + 
                          (testResult ? testResult.length : 'unknown')
              });
            } catch (testErr) {
              self.postMessage({ 
                type: 'log', 
                message: 'TEST ENCODE FAILED: ' + testErr.message + 
                          '\\nStack: ' + testErr.stack
              });
              throw new Error('MP3 encoder test failed: ' + testErr.message);
            }
            
            // Encode actual data in blocks
            const mp3Data = [];
            
            for (let block = 0; block < totalBlocks; block++) {
              // Calculate start sample for this block
              const offset = block * blockSize;
              
              // How many samples remain to process
              const samplesRemaining = samplesPerChannel - offset;
              const currentBlockSize = Math.min(blockSize, samplesRemaining);
              
              // Log block processing (not too verbose)
              if (block === 0 || block === totalBlocks-1 || block % 20 === 0) {
                self.postMessage({ 
                  type: 'log', 
                  message: 'PROCESSING BLOCK ' + block + '/' + totalBlocks + 
                            ', samples ' + offset + '-' + (offset + currentBlockSize - 1)
                });
              }
              
              // Create input buffers for this block
              const blockLeft = new Int16Array(blockSize);
              const blockRight = (channels > 1) ? new Int16Array(blockSize) : null;
              
              // Fill with zeros (important for partial blocks)
              blockLeft.fill(0);
              if (blockRight) blockRight.fill(0);
              
              // Copy actual data for this block
              for (let i = 0; i < currentBlockSize; i++) {
                if (offset + i < leftChannel.length) {
                  blockLeft[i] = leftChannel[offset + i];
                }
                
                if (channels > 1 && blockRight && offset + i < rightChannel.length) {
                  blockRight[i] = rightChannel[offset + i];
                }
              }
              
              // Encode with proper error handling
              try {
                let mp3Buffer;
                if (channels > 1 && blockRight) {
                  mp3Buffer = mp3encoder.encodeBuffer(blockLeft, blockRight);
                } else {
                  mp3Buffer = mp3encoder.encodeBuffer(blockLeft);
                }
                
                if (mp3Buffer && mp3Buffer.length > 0) {
                  mp3Data.push(mp3Buffer);
                  
                  // Log first block success for debugging
                  if (block === 0) {
                    self.postMessage({ 
                      type: 'log', 
                      message: 'First MP3 block encoded: ' + mp3Buffer.length + ' bytes'
                    });
                  }
                } else if (block === 0) {
                  // Something's wrong if first block gave empty result
                  self.postMessage({ 
                    type: 'log', 
                    message: 'WARNING: First MP3 block returned empty buffer'
                  });
                }
              } catch (encodeErr) {
                self.postMessage({ 
                  type: 'log', 
                  message: 'ENCODE ERROR in block ' + block + ': ' + encodeErr.message + 
                            '\\nStack: ' + encodeErr.stack
                });
                throw encodeErr;
              }
              
              // Report progress
              if (block % 10 === 0 || block === totalBlocks - 1) {
                const progress = Math.min(100, Math.round((block / totalBlocks) * 100));
                self.postMessage({ type: 'progress', progress });
              }
            }
            
            // Finalize MP3 encoding
            self.postMessage({ 
              type: 'log', 
              message: 'MP3 blocks processed, finalizing with flush()'
            });
            
            try {
              const flushBuffer = mp3encoder.flush();
              
              if (flushBuffer && flushBuffer.length > 0) {
                mp3Data.push(flushBuffer);
                self.postMessage({ 
                  type: 'log', 
                  message: 'MP3 flush successful: ' + flushBuffer.length + ' bytes'
                });
              } else {
                self.postMessage({ 
                  type: 'log', 
                  message: 'MP3 flush returned empty buffer'
                });
              }
            } catch (flushErr) {
              self.postMessage({ 
                type: 'log', 
                message: 'FLUSH ERROR: ' + flushErr.message + 
                          '\\nStack: ' + flushErr.stack
              });
              throw flushErr;
            }
            
            // Combine all MP3 chunks
            let totalLength = 0;
            for (let i = 0; i < mp3Data.length; i++) {
              totalLength += mp3Data[i].length;
            }
            
            if (totalLength === 0) {
              throw new Error('No MP3 data generated (buffer length is 0)');
            }
            
            self.postMessage({ 
              type: 'log', 
              message: 'MP3 encoding complete: ' + totalLength + ' bytes in ' + 
                        mp3Data.length + ' chunks'
            });
            
            // Create final buffer and copy data
            const mp3Buffer = new Uint8Array(totalLength);
            let position = 0;
            for (let i = 0; i < mp3Data.length; i++) {
              mp3Buffer.set(mp3Data[i], position);
              position += mp3Data[i].length;
            }
            
            // Send back the result
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
        channels: Math.min(2, audioBuffer.numberOfChannels), // MP3 only supports up to 2 channels
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
