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
      
      // Get the full origin URL to ensure we get the right base path
      const baseUrl = window.location.origin;
      
      // Create a worker with inline code
      const workerCode = `
        // Import lamejs library from public path
        try {
          // Using full absolute URL to ensure the library is found
          importScripts('${baseUrl}/libs/lamejs/lame.all.js');
          console.log('Worker: lamejs library loaded successfully');
        } catch (e) {
          console.error('Worker: Failed to load lamejs library:', e);
          self.postMessage({ type: 'error', error: 'Failed to load MP3 encoder library: ' + e.message });
          return;
        }

        self.onmessage = function(e) {
          const { wavBuffer, channels, sampleRate, quality } = e.data;
          
          console.log('Worker: Starting MP3 encoding with ' + quality + 'kbps quality');
          
          try {
            // Create MP3 encoder
            const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, quality);
            
            // Get WAV samples as float32, we need to convert to int16
            const wavBytes = new Uint8Array(wavBuffer);
            
            // Skip WAV header - find the data section
            let dataStartIndex = 0;
            for (let i = 0; i < wavBytes.length - 4; i++) {
              if (wavBytes[i] === 100 && wavBytes[i+1] === 97 && wavBytes[i+2] === 116 && wavBytes[i+3] === 97) {
                // 'data' chunk found, skip the identifier and chunk size (8 bytes)
                dataStartIndex = i + 8;
                break;
              }
            }
            
            // Get samples from WAV
            const samples = new Int16Array((wavBytes.length - dataStartIndex) / 2);
            
            // Extract samples data
            for (let i = 0; i < samples.length; i++) {
              const idx = dataStartIndex + (i * 2);
              samples[i] = (wavBytes[idx] | (wavBytes[idx + 1] << 8));
            }
            
            const blockSize = 1152; // MPEG1 Layer 3 requires 1152 samples per frame
            const mp3Data = [];
            
            // Get left and right channels
            const left = new Int16Array(blockSize);
            const right = channels > 1 ? new Int16Array(blockSize) : null;
            
            const totalBlocks = Math.ceil(samples.length / (channels * blockSize));
            
            for (let i = 0; i < totalBlocks; i++) {
              const offset = i * channels * blockSize;
              const remaining = Math.min(blockSize, (samples.length - offset) / channels);
              
              // Clear arrays
              left.fill(0);
              if (right) right.fill(0);
              
              // Extract channel data
              for (let j = 0; j < remaining; j++) {
                if (channels > 1) {
                  left[j] = samples[offset + (j * 2)];
                  right[j] = samples[offset + (j * 2) + 1];
                } else {
                  left[j] = samples[offset + j];
                }
              }
              
              // Encode frame
              let mp3buf;
              if (channels > 1) {
                mp3buf = mp3encoder.encodeBuffer(left, right);
              } else {
                mp3buf = mp3encoder.encodeBuffer(left);
              }
              
              if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
              }
              
              // Report progress
              const progress = Math.min(100, Math.round((i / totalBlocks) * 100));
              self.postMessage({ type: 'progress', progress });
            }
            
            // Finalize
            const finalMp3buf = mp3encoder.flush();
            if (finalMp3buf.length > 0) {
              mp3Data.push(finalMp3buf);
            }
            
            // Combine all chunks
            let totalLength = 0;
            for (let i = 0; i < mp3Data.length; i++) {
              totalLength += mp3Data[i].length;
            }
            
            const mp3Buffer = new Uint8Array(totalLength);
            let offset = 0;
            for (let i = 0; i < mp3Data.length; i++) {
              mp3Buffer.set(mp3Data[i], offset);
              offset += mp3Data[i].length;
            }
            
            console.log('Worker: MP3 encoding complete, size: ' + mp3Buffer.length + ' bytes');
            self.postMessage({ 
              type: 'complete', 
              buffer: mp3Buffer.buffer,
              size: mp3Buffer.length
            }, [mp3Buffer.buffer]);
          } catch (err) {
            console.error('Worker: MP3 encoding error:', err);
            self.postMessage({ type: 'error', error: 'MP3 encoding failed: ' + err.message });
          }
        };
      `;
      
      // Create the worker
      const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(workerBlob);
      const worker = new Worker(workerUrl);
      
      // Error timeout (10 seconds)
      const errorTimeout = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        reject(new Error('MP3 conversion timed out after 10 seconds'));
      }, 30000);
      
      // Handle worker messages
      worker.onmessage = (e) => {
        const { type, progress, buffer, error, size } = e.data;
        
        if (type === 'progress' && onProgress) {
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
          reject(new Error(error));
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
      log(`Error starting conversion: ${error.message}`);
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
