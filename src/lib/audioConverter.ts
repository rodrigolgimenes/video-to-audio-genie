
// Function to read a file as an ArrayBuffer
export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// Function to decode audio data from an ArrayBuffer
export const decodeAudioData = async (audioContext: AudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> => {
  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error("Error decoding audio data:", error);
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

// Create a Web Worker for MP3 conversion
export const createMp3ConversionWorker = (): Worker => {
  const workerCode = `
    importScripts("https://unpkg.com/lamejs@1.2.1/worker/lame.min.js");

    onmessage = function(e) {
      const { wavBuffer, channels, sampleRate } = e.data;
      const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);
      
      // Convert the WAV buffer to Int16Array for processing
      const wavData = new Int16Array(wavBuffer);
      const samples = channels === 1 ? [wavData] : [new Int16Array(wavData.length/2), new Int16Array(wavData.length/2)];
      
      // If stereo, separate channels
      if (channels === 2) {
        for (let i = 0; i < wavData.length; i += 2) {
          samples[0][i/2] = wavData[i];
          samples[1][i/2] = wavData[i+1];
        }
      }
      
      const mp3Data = [];
      const blockSize = 1152; // Multiple of 576 (minimum MP3 granule size)
      
      // Process the audio in chunks
      for (let i = 0; i < samples[0].length; i += blockSize) {
        // Calculate progress percentage and send it back
        const progress = i / samples[0].length;
        self.postMessage({ type: 'progress', progress });
        
        let sampleChunk;
        if (channels === 1) {
          sampleChunk = samples[0].subarray(i, i + blockSize);
          const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
          if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
          }
        } else {
          const leftChunk = samples[0].subarray(i, i + blockSize);
          const rightChunk = samples[1].subarray(i, i + blockSize);
          const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
          if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
          }
        }
      }
      
      // Flush the encoder and get the remaining MP3 data
      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));
      }
      
      // Concatenate all MP3 chunks
      let totalLength = mp3Data.reduce((sum, arr) => sum + arr.length, 0);
      let result = new Uint8Array(totalLength);
      let offset = 0;
      
      mp3Data.forEach(arr => {
        result.set(arr, offset);
        offset += arr.length;
      });
      
      // Send the complete MP3 data back to the main thread
      self.postMessage({ 
        type: 'complete', 
        mp3Buffer: result.buffer 
      }, [result.buffer]);
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

// Convert WAV buffer to MP3 using a Web Worker
export const convertWavToMp3 = (wavBuffer: ArrayBuffer, channels: number, sampleRate: number): Promise<{ mp3Buffer: ArrayBuffer, progress: number }> => {
  return new Promise((resolve, reject) => {
    const worker = createMp3ConversionWorker();
    
    worker.onmessage = (event) => {
      const { type, mp3Buffer, progress } = event.data;
      
      if (type === 'progress') {
        // If it's a progress update, we don't resolve yet but can report progress
        resolve({ mp3Buffer: new ArrayBuffer(0), progress });
      } else if (type === 'complete') {
        // Once complete, resolve with the final MP3 buffer
        worker.terminate();
        resolve({ mp3Buffer, progress: 1 });
      }
    };
    
    worker.onerror = (error) => {
      worker.terminate();
      reject(error);
    };
    
    // Send the WAV data to the worker for processing
    worker.postMessage({
      wavBuffer: wavBuffer,
      channels: channels,
      sampleRate: sampleRate
    }, [wavBuffer]);
  });
};
