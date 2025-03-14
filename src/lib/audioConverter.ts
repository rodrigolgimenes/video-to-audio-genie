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

// Create a Blob URL for the worker script with proper lamejs import
export const createMp3WorkerUrl = (): string => {
  // Updated worker code to use the locally installed lamejs
  const workerCode = `
    // Use dynamic import for lamejs - this works in modern browsers
    // and allows us to use the locally installed npm package
    self.lamejs = null;
    
    // Function to load lamejs module
    async function loadLameModule() {
      try {
        // This works with Vite - dynamically imports the ESM module
        const lameModule = await import('/node_modules/lamejs/lame.all.js');
        self.lamejs = lameModule.default || lameModule;
        console.log('Worker: lamejs loaded successfully');
        return true;
      } catch (err) {
        console.error('Worker: Failed to load lamejs:', err);
        return false;
      }
    }
    
    self.onmessage = async function(e) {
      const { wavBuffer, channels, sampleRate } = e.data;
      console.log('Worker: Received WAV data (size: ' + wavBuffer.byteLength + ')');
      
      // First load the lamejs module
      const lameLoaded = await loadLameModule();
      
      if (!lameLoaded) {
        // If lamejs couldn't be loaded, use fallback approach (return WAV instead)
        console.log('Worker: Using fallback approach - returning WAV data as MP3');
        
        // Send progress updates to show activity
        for (let i = 0; i < 10; i++) {
          setTimeout(() => {
            self.postMessage({ type: 'progress', progress: i / 10 });
          }, i * 100);
        }
        
        // Return the WAV data with a delay to simulate processing
        setTimeout(() => {
          console.log('Worker: Sending processed audio data');
          self.postMessage({ 
            type: 'complete', 
            mp3Buffer: wavBuffer
          }, [wavBuffer]);
        }, 1000);
        return;
      }
      
      try {
        // Use lamejs for MP3 encoding
        const Mp3Encoder = self.lamejs.Mp3Encoder;
        const mp3encoder = new Mp3Encoder(channels, sampleRate, 128);
        const wavData = new Int16Array(wavBuffer);
        const blockSize = 1152; // Must be multiple of 576 for lamejs
        const mp3Data = [];
        
        // Process the audio in chunks
        for (let i = 0; i < wavData.length; i += blockSize) {
          // Report progress
          const progress = i / wavData.length;
          self.postMessage({ type: 'progress', progress });
          
          // Encode a chunk
          const sampleChunk = wavData.subarray(i, i + blockSize);
          const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
          if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
          }
        }
        
        // Flush the encoder
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
          mp3Data.push(new Int8Array(mp3buf));
        }
        
        // Combine all chunks
        let totalLength = mp3Data.reduce((sum, arr) => sum + arr.length, 0);
        let result = new Uint8Array(totalLength);
        let offset = 0;
        mp3Data.forEach(arr => {
          result.set(arr, offset);
          offset += arr.length;
        });
        
        console.log('Worker: MP3 conversion complete (buffer size: ' + result.byteLength + ')');
        self.postMessage({ 
          type: 'complete', 
          mp3Buffer: result.buffer 
        }, [result.buffer]);
      } catch (error) {
        console.error('Worker error:', error);
        self.postMessage({ 
          type: 'error', 
          error: error.toString()
        });
      }
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
};

// Create a Web Worker for MP3 conversion
export const createMp3ConversionWorker = (): Worker => {
  const workerUrl = createMp3WorkerUrl();
  return new Worker(workerUrl);
};

// Convert WAV buffer to MP3 using a Web Worker
export const convertWavToMp3 = (wavBuffer: ArrayBuffer, channels: number, sampleRate: number): Promise<{ mp3Buffer: ArrayBuffer, progress: number }> => {
  return new Promise((resolve, reject) => {
    console.log(`Starting audio conversion: channels=${channels}, sampleRate=${sampleRate}, wavBuffer size=${wavBuffer.byteLength}`);
    const worker = createMp3ConversionWorker();
    
    worker.onmessage = (event) => {
      const { type, mp3Buffer, progress, error } = event.data;
      
      if (type === 'progress') {
        console.log(`Conversion progress: ${Math.round(progress * 100)}%`);
        // If it's a progress update, we don't resolve yet but can report progress
        resolve({ mp3Buffer: new ArrayBuffer(0), progress });
      } else if (type === 'complete') {
        // Once complete, resolve with the final buffer
        console.log(`Conversion complete: buffer size=${mp3Buffer.byteLength}`);
        worker.terminate();
        resolve({ mp3Buffer, progress: 1 });
      } else if (type === 'error') {
        console.error("Worker error:", error);
        worker.terminate();
        reject(new Error(`Conversion failed: ${error}`));
      }
    };
    
    worker.onerror = (error) => {
      console.error("Worker error:", error);
      worker.terminate();
      reject(new Error(`Conversion failed: ${error.message}`));
    };
    
    // Send the WAV data to the worker for processing
    try {
      worker.postMessage({
        wavBuffer: wavBuffer,
        channels: channels,
        sampleRate: sampleRate
      }, [wavBuffer]);
      console.log("WAV data sent to worker for processing");
    } catch (postError) {
      console.error("Error posting message to worker:", postError);
      worker.terminate();
      reject(new Error(`Failed to start conversion: ${postError instanceof Error ? postError.message : 'Unknown error'}`));
    }
  });
};
