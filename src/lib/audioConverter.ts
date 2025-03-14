
// Function to read a file as an ArrayBuffer
export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = (event) => {
      console.error("FileReader error:", event);
      reject(new Error("Failed to read the file"));
    };
    reader.readAsArrayBuffer(file);
  });
};

// Function to decode audio data from an ArrayBuffer
export const decodeAudioData = async (audioContext: AudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> => {
  try {
    console.log(`Attempting to decode audio data of size ${arrayBuffer.byteLength} bytes`);
    
    // Clone the buffer to avoid "buffer detached" errors
    const bufferCopy = arrayBuffer.slice(0);
    
    try {
      const result = await audioContext.decodeAudioData(bufferCopy);
      console.log(`Audio successfully decoded: ${result.numberOfChannels} channels, ${result.sampleRate}Hz, ${result.length} samples`);
      return result;
    } catch (decodeError) {
      console.error("Browser decodeAudioData failed:", decodeError);
      
      // Try an alternative approach for specific errors
      if (decodeError instanceof DOMException && decodeError.name === "EncodingError") {
        console.log("Trying alternative decoding method...");
        // Here you could implement an alternative decoder or fallback
      }
      
      throw new Error(`Failed to decode audio: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error("Error in decodeAudioData function:", error);
    throw new Error("Failed to decode audio from video. The video format might not be supported.");
  }
};

// Convert AudioBuffer to WAV format
export const convertAudioBufferToWav = (audioBuffer: AudioBuffer): ArrayBuffer => {
  const numOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numOfChannels * 2; // 2 bytes per sample
  const sampleRate = audioBuffer.sampleRate;
  
  // Create the WAV file header
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  
  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChannels * 2, true); // byte rate
  view.setUint16(32, numOfChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);
  
  // Write the PCM samples
  const data = new Int16Array(buffer, 44, length / 2);
  let offset = 0;
  
  for (let i = 0; i < numOfChannels; i++) {
    const channelData = audioBuffer.getChannelData(i);
    for (let j = 0; j < audioBuffer.length; j++) {
      // Convert Float32 to Int16
      const index = (j * numOfChannels) + i;
      const sample = Math.max(-1, Math.min(1, channelData[j]));
      data[index] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
  }
  
  return buffer;
};

// Helper function to write a string to a DataView
const writeString = (view: DataView, offset: number, string: string): void => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

// Create a Blob URL for the worker script
export const createMp3WorkerUrl = (): string => {
  // Updated worker code that uses lamejs to properly convert WAV to MP3
  const workerCode = `
    // Import lamejs library
    importScripts('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js');

    self.onmessage = function(e) {
      const { wavBuffer, channels, sampleRate } = e.data;
      console.log('Worker: Received WAV data (size: ' + wavBuffer.byteLength + ')');
      
      try {
        // Parse the WAV header to find where the PCM data starts
        // WAV header is typically 44 bytes
        const dataOffset = 44;
        
        // Create a view of the buffer so we can read the PCM data
        const wavDataView = new DataView(wavBuffer);
        const pcmData = new Int16Array(wavBuffer, dataOffset);
        
        // Configure MP3 encoder
        const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);
        const mp3Data = [];
        
        // Process the PCM data in chunks to avoid memory issues
        const sampleBlockSize = 1152; // This must be a multiple of 576 for lamejs
        const totalSamples = pcmData.length;
        const totalChunks = Math.ceil(totalSamples / sampleBlockSize);
        let currentChunk = 0;
        
        // Setup progress tracking
        const reportProgressInterval = Math.max(1, Math.floor(totalChunks / 20)); // Report ~20 updates
        
        // Convert each chunk
        for (let i = 0; i < totalSamples; i += sampleBlockSize) {
          // Extract a block of samples
          const sampleChunk = pcmData.subarray(i, Math.min(i + sampleBlockSize, totalSamples));
          
          // Convert to the format needed by lamejs
          const leftChunk = new Int16Array(sampleBlockSize);
          const rightChunk = new Int16Array(sampleBlockSize);
          
          // Fill the channels based on the input
          if (channels === 1) {
            // Mono: copy the same data to both channels
            for (let j = 0; j < sampleChunk.length; j++) {
              leftChunk[j] = sampleChunk[j];
              rightChunk[j] = sampleChunk[j];
            }
          } else {
            // Stereo: alternate samples for left and right channels
            for (let j = 0, k = 0; j < sampleChunk.length; j += 2, k++) {
              leftChunk[k] = sampleChunk[j];
              rightChunk[k] = sampleChunk[j + 1];
            }
          }
          
          // Encode this chunk
          let mp3buf;
          if (channels === 1) {
            mp3buf = mp3encoder.encodeBuffer(leftChunk.subarray(0, sampleChunk.length));
          } else {
            mp3buf = mp3encoder.encodeBuffer(leftChunk.subarray(0, sampleChunk.length / 2), 
                                             rightChunk.subarray(0, sampleChunk.length / 2));
          }
          
          if (mp3buf && mp3buf.length > 0) {
            mp3Data.push(mp3buf);
          }
          
          // Report progress
          currentChunk++;
          if (currentChunk % reportProgressInterval === 0 || currentChunk === totalChunks) {
            const progressPercentage = currentChunk / totalChunks;
            self.postMessage({ 
              type: 'progress', 
              progress: progressPercentage
            });
          }
        }
        
        // Finalize the MP3
        const mp3buf = mp3encoder.flush();
        if (mp3buf && mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
        
        // Combine all chunks into a single buffer
        let totalLength = 0;
        mp3Data.forEach(buffer => {
          totalLength += buffer.length;
        });
        
        const mp3Buffer = new Uint8Array(totalLength);
        let offset = 0;
        mp3Data.forEach(buffer => {
          mp3Buffer.set(buffer, offset);
          offset += buffer.length;
        });
        
        // Complete the conversion and return the result
        console.log('Worker: MP3 encoding complete, returning audio data');
        self.postMessage({ 
          type: 'complete', 
          mp3Buffer: mp3Buffer.buffer,
          format: 'audio/mpeg'
        }, [mp3Buffer.buffer]);
        
        // Clean up - ensure worker can be terminated
        setTimeout(() => self.close(), 100);
      } catch (err) {
        console.error('Worker error:', err);
        self.postMessage({ 
          type: 'error', 
          error: err.toString()
        });
        self.close();
      }
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
};

// Create a Web Worker for audio conversion
export const createMp3ConversionWorker = (): Worker => {
  const workerUrl = createMp3WorkerUrl();
  return new Worker(workerUrl);
};

// Convert WAV buffer to MP3 using a Web Worker
export const convertWavToMp3 = (wavBuffer: ArrayBuffer, channels: number, sampleRate: number): Promise<{ mp3Buffer: ArrayBuffer, progress: number, format?: string }> => {
  return new Promise((resolve, reject) => {
    console.log(`Starting audio conversion: channels=${channels}, sampleRate=${sampleRate}, wavBuffer size=${wavBuffer.byteLength}`);
    const worker = createMp3ConversionWorker();
    let lastProgressReported = false;
    
    worker.onmessage = (event) => {
      const { type, mp3Buffer, progress, format, error } = event.data;
      
      if (type === 'progress') {
        console.log(`Conversion progress: ${Math.round(progress * 100)}%`);
        
        // If it's a progress update, we don't resolve yet but can report progress
        // Don't resolve for progress updates as the promise can only resolve once
        if (!lastProgressReported) {
          resolve({ mp3Buffer: new ArrayBuffer(0), progress, format });
          lastProgressReported = true;
        }
      } else if (type === 'complete') {
        // Once complete, resolve with the final buffer
        console.log(`Conversion complete: buffer size=${mp3Buffer.byteLength}`);
        worker.terminate();
        resolve({ mp3Buffer, progress: 1, format });
      } else if (type === 'error') {
        console.error("Worker error:", error);
        worker.terminate();
        reject(new Error(`Conversion failed: ${error}`));
      }
    };
    
    worker.onerror = (errorEvent) => {
      console.error("Worker error:", errorEvent);
      worker.terminate();
      reject(new Error(`Conversion failed: ${errorEvent.message}`));
    };
    
    // Send the WAV data to the worker for processing
    try {
      // Make a copy of the buffer to avoid transfer issues
      const bufferCopy = wavBuffer.slice(0);
      worker.postMessage({
        wavBuffer: bufferCopy,
        channels: channels,
        sampleRate: sampleRate
      }, [bufferCopy]);
      console.log("WAV data sent to worker for processing");
    } catch (postError) {
      console.error("Error posting message to worker:", postError);
      worker.terminate();
      reject(new Error(`Failed to start conversion: ${postError instanceof Error ? postError.message : 'Unknown error'}`));
    }
  });
};
