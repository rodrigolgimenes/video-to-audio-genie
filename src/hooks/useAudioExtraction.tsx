
import { useState, useCallback, useEffect } from 'react';
import { convertAudioBufferToWav, convertAudioBufferToMp3, createLogger } from '../lib/audioConverter';
import { log as globalLog, error as globalError } from '../lib/logger';

export function useAudioExtraction() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFormat, setAudioFormat] = useState<string>('');
  const [audioSize, setAudioSize] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Helper to add logs
  const addLog = useCallback((message: string) => {
    globalLog(message);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  }, []);
  
  // Helper to add error logs
  const addErrorLog = useCallback((message: string) => {
    globalError(message);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ERROR: ${message}`]);
  }, []);

  // Check lamejs availability on load
  useEffect(() => {
    addLog('Environment check: Starting diagnostics...');
    
    // Check if AudioContext is available
    if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
      addLog('Environment check: AudioContext is available');
    } else {
      addErrorLog('Environment check: AudioContext is NOT available - audio processing will fail');
    }
    
    // Check if Web Workers are available
    if (typeof Worker !== 'undefined') {
      addLog('Environment check: Web Workers are available');
    } else {
      addErrorLog('Environment check: Web Workers are NOT available - MP3 conversion will fail');
    }
    
    // Test lamejs global availability
    if (typeof (window as any).lamejs !== 'undefined') {
      addLog(`Environment check: lamejs is available in global scope: ${typeof (window as any).lamejs}`);
      
      // Check Mp3Encoder
      if (typeof (window as any).lamejs.Mp3Encoder === 'function') {
        addLog('Environment check: Mp3Encoder constructor is available');
      } else {
        addErrorLog(`Environment check: Mp3Encoder is not available or not a constructor: ${typeof (window as any).lamejs.Mp3Encoder}`);
      }
    } else {
      addLog('Environment check: lamejs is NOT available in global scope, will attempt dynamic loading');
      
      // Try loading lamejs script in main thread to verify it's accessible
      try {
        const script = document.createElement('script');
        const fullPath = window.location.origin + '/libs/lamejs/lame.all.js';
        script.src = fullPath;
        addLog(`Environment check: Trying to load lamejs from ${fullPath}`);
        
        script.onload = () => {
          if (typeof (window as any).lamejs !== 'undefined') {
            addLog(`Environment check: Successfully loaded lamejs dynamically: ${typeof (window as any).lamejs}`);
            // Check if it has the Mp3Encoder
            if (typeof (window as any).lamejs.Mp3Encoder === 'function') {
              addLog('Environment check: Mp3Encoder constructor is available after dynamic load');
            } else {
              addErrorLog('Environment check: Mp3Encoder is not available after dynamic load');
            }
          } else {
            addErrorLog('Environment check: lamejs failed to load into global scope after dynamic loading');
          }
        };
        script.onerror = (e) => {
          addErrorLog(`Environment check: Failed to load lamejs script: ${e}`);
        };
        document.head.appendChild(script);
      } catch (err) {
        addErrorLog(`Environment check: Error during dynamic script loading: ${(err as Error).message}`);
      }
    }
    
    // Check for blob URL support
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      addLog('Environment check: Blob URL creation is supported');
    } else {
      addErrorLog('Environment check: Blob URL creation is NOT supported - audio download will fail');
    }
    
    // Check if the libs/lamejs/lame.all.js file is accessible
    fetch(window.location.origin + '/libs/lamejs/lame.all.js', { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          addLog(`Environment check: lame.all.js is accessible at ${response.url} (status: ${response.status})`);
        } else {
          addErrorLog(`Environment check: lame.all.js is NOT accessible (status: ${response.status})`);
        }
      })
      .catch(err => {
        addErrorLog(`Environment check: Error checking lame.all.js accessibility: ${err.message}`);
      });
    
    addLog('Environment check: Diagnostics complete');
  }, [addLog, addErrorLog]);

  const extractAudio = useCallback(async (selectedFile: File, quality: number = 128) => {
    if (!selectedFile) return;
    
    try {
      const logger = createLogger(addLog);
      setIsProcessing(true);
      setProgress(0);
      setAudioUrl(null);
      setAudioFormat('');
      setAudioSize(undefined);
      setError(null);
      setLogs([]);
      
      // Step 1: Read the file as ArrayBuffer
      logger('Starting to read video file as ArrayBuffer');
      const fileBuffer = await selectedFile.arrayBuffer();
      logger(`Successfully read video file (${fileBuffer.byteLength} bytes)`);
      
      // Step 2: Create an AudioContext
      logger('Creating AudioContext');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      logger('AudioContext created, starting audio decoding');
      
      // Step 3: Decode the audio data
      logger(`Attempting to decode audio data of size ${fileBuffer.byteLength} bytes`);
      try {
        const audioBuffer = await audioContext.decodeAudioData(fileBuffer);
        logger(`Audio successfully decoded: ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz, ${audioBuffer.length} samples`);
        
        // Test lamejs availability before conversion
        logger('PRE-CHECK: Testing lamejs availability before conversion...');
        try {
          const testScript = document.createElement('script');
          const fullPath = window.location.origin + '/libs/lamejs/lame.all.js';
          testScript.src = fullPath;
          logger(`PRE-CHECK: Trying to load lamejs from ${fullPath}`);
          
          testScript.onload = () => {
            logger('PRE-CHECK: lamejs script loaded successfully in main thread');
            if ((window as any).lamejs) {
              logger(`PRE-CHECK: lamejs is available in global scope: ${typeof (window as any).lamejs}`);
              
              // Check Mp3Encoder specifically
              if (typeof (window as any).lamejs.Mp3Encoder === 'function') {
                logger('PRE-CHECK: Mp3Encoder constructor is available and is a function');
                
                // Try creating an encoder instance to validate
                try {
                  const testEncoder = new (window as any).lamejs.Mp3Encoder(1, 44100, quality);
                  logger(`PRE-CHECK: Successfully created test Mp3Encoder: ${typeof testEncoder}`);
                  
                  // Test if the encoder has the expected methods
                  if (typeof testEncoder.encodeBuffer === 'function' && typeof testEncoder.flush === 'function') {
                    logger('PRE-CHECK: Mp3Encoder has the expected methods (encodeBuffer, flush)');
                  } else {
                    logger('PRE-CHECK: WARNING: Mp3Encoder does not have expected methods');
                  }
                } catch (encErr) {
                  logger(`PRE-CHECK: ERROR creating Mp3Encoder instance: ${(encErr as Error).message}`);
                }
              } else {
                logger(`PRE-CHECK: WARNING: Mp3Encoder is not a constructor: ${typeof (window as any).lamejs.Mp3Encoder}`);
              }
            } else {
              logger('PRE-CHECK: lamejs not found in global scope after script load');
            }
          };
          testScript.onerror = (e) => {
            logger(`PRE-CHECK: Error loading lamejs script: ${e}`);
          };
          document.head.appendChild(testScript);
        } catch (preCheckError) {
          logger(`PRE-CHECK: Error testing lamejs: ${(preCheckError as Error).message}`);
        }
        
        // Step 4: Check if lame.all.js is accessible
        logger('Checking if lame.all.js is accessible...');
        try {
          // Try to verify if the lame.all.js file is accessible
          const fullPathToLib = window.location.origin + '/libs/lamejs/lame.all.js';
          logger(`Checking if lame.all.js is accessible at ${fullPathToLib}`);
          
          const testResponse = await fetch(fullPathToLib, { method: 'HEAD' });
          if (testResponse.ok) {
            logger(`lame.all.js is accessible at ${fullPathToLib} (status: ${testResponse.status})`);
            
            // Try to fetch it to see the content
            try {
              const scriptContent = await fetch(fullPathToLib).then(r => r.text());
              logger(`Successfully fetched lame.all.js content (${scriptContent.length} characters)`);
              logger(`First 100 characters: ${scriptContent.substring(0, 100)}...`);
            } catch (fetchContentError) {
              logger(`WARNING: Could not read lame.all.js content: ${(fetchContentError as Error).message}`);
            }
          } else {
            logger(`WARNING: lame.all.js might not be accessible (status: ${testResponse.status})`);
          }
        } catch (fetchError) {
          logger(`WARNING: Could not check lame.all.js accessibility: ${(fetchError as Error).message}`);
        }
        
        try {
          logger(`Starting MP3 conversion with maximum compression (quality: ${quality}kbps)`);
          const { buffer: mp3Buffer, format } = await convertAudioBufferToMp3(
            audioBuffer,
            quality,
            (percent) => setProgress(percent)
          );
          
          // Create a Blob and URL for the MP3
          const blob = new Blob([mp3Buffer], { type: format });
          const url = URL.createObjectURL(blob);
          
          setAudioUrl(url);
          setAudioFormat(format);
          setAudioSize(blob.size);
          setProgress(100);
          logger(`MP3 conversion successful: ${blob.size} bytes (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
          
        } catch (mp3Error) {
          addErrorLog(`MP3 conversion failed: ${(mp3Error as Error).message}`);
          logger('Falling back to WAV format (larger file)');
          
          // Fallback to WAV if MP3 conversion fails
          const wavBuffer = convertAudioBufferToWav(audioBuffer);
          
          // Create a Blob and URL for the WAV
          const blob = new Blob([wavBuffer], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          
          setAudioUrl(url);
          setAudioFormat('audio/wav');
          setAudioSize(blob.size);
          setProgress(100);
          logger(`WAV fallback successful: ${blob.size} bytes (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
        }
        
      } catch (decodeError) {
        throw new Error(`Failed to decode audio data: ${(decodeError as Error).message}`);
      }
      
    } catch (error) {
      setError(`Erro na conversão: ${(error as Error).message}`);
      addErrorLog(`Error: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [addLog, addErrorLog]);

  // Generate appropriate output filename based on input
  const getOutputFileName = useCallback((inputFileName: string) => {
    const baseName = inputFileName.replace(/\.[^/.]+$/, '');
    const extension = audioFormat === 'audio/mpeg' ? '.mp3' : '.wav';
    return `${baseName}${extension}`;
  }, [audioFormat]);

  return {
    isProcessing,
    progress,
    audioUrl,
    audioFormat,
    audioSize,
    error,
    logs,
    extractAudio,
    getOutputFileName
  };
}
