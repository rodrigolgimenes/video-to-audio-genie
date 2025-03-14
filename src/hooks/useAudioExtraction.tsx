
import { useState, useCallback } from 'react';
import { 
  readFileAsArrayBuffer, 
  decodeAudioData, 
  convertAudioBufferToWav, 
  convertWavToMp3 
} from '@/lib/audioConverter';
import { useToast } from "@/hooks/use-toast";

export const useAudioExtraction = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFormat, setAudioFormat] = useState<string>('audio/mpeg');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const addLog = useCallback((message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  }, []);

  const extractAudio = useCallback(async (selectedFile: File) => {
    if (!selectedFile) return;
    
    try {
      setIsProcessing(true);
      setProgress(0);
      setError(null);
      setLogs([]);
      setAudioUrl(null);
      
      // Step 1: Read the video file as ArrayBuffer
      addLog("Starting to read video file as ArrayBuffer");
      const videoArrayBuffer = await readFileAsArrayBuffer(selectedFile);
      addLog(`Successfully read video file (${videoArrayBuffer.byteLength} bytes)`);
      
      // Step 2: Create AudioContext and decode the audio
      addLog("Creating AudioContext");
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      addLog("AudioContext created, starting audio decoding");
      
      try {
        const audioBuffer = await decodeAudioData(audioContext, videoArrayBuffer);
        addLog(`Audio decoded successfully: ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz, ${audioBuffer.length} samples`);
        
        // Step 3: Convert AudioBuffer to WAV
        addLog("Converting AudioBuffer to WAV format");
        const wavBuffer = convertAudioBufferToWav(audioBuffer);
        addLog(`WAV conversion complete (${wavBuffer.byteLength} bytes)`);
        
        // Step 4: Process the audio data
        addLog("Starting MP3 conversion with Web Worker");
        
        let conversionAttempts = 0;
        const maxAttempts = 3;
        let finalBuffer: ArrayBuffer | null = null;
        let format = 'audio/wav'; // Default to WAV
        
        while (finalBuffer === null && conversionAttempts < maxAttempts) {
          conversionAttempts++;
          
          try {
            // Track progress updates
            let lastProgress = 0;
            let conversionComplete = false;
            
            // Start the conversion process
            const processingPromise = convertWavToMp3(
              wavBuffer.slice(0), // Create a copy since the worker consumes the original
              audioBuffer.numberOfChannels,
              audioBuffer.sampleRate
            );
            
            // Since we need to handle multiple progress updates, we'll use
            // the promise differently
            processingPromise.then(
              ({ mp3Buffer, progress, format: workerFormat }) => {
                // Update progress state
                if (progress > lastProgress) {
                  lastProgress = progress;
                  setProgress(progress * 100);
                  
                  // Only log significant progress changes
                  if (Math.floor(progress * 10) > Math.floor(lastProgress * 10)) {
                    addLog(`Processing progress: ${Math.round(progress * 100)}%`);
                  }
                }
                
                // If conversion is complete (progress === 1)
                if (progress === 1 && !conversionComplete) {
                  conversionComplete = true;
                  finalBuffer = mp3Buffer;
                  
                  if (workerFormat) {
                    format = workerFormat;
                  }
                  
                  addLog(`Processing complete (${finalBuffer.byteLength} bytes) as ${format}`);
                  
                  // Create the audio blob and URL
                  const audioBlob = new Blob([finalBuffer], { type: format });
                  setAudioFormat(format);
                  const url = URL.createObjectURL(audioBlob);
                  setAudioUrl(url);
                  
                  toast({
                    title: "Conversion complete!",
                    description: "Your audio file is ready for download."
                  });
                  
                  addLog("Conversion process completed successfully");
                  setIsProcessing(false);
                }
              },
              (error) => {
                throw error;
              }
            );
            
            // Wait up to 10 seconds for conversion to complete
            let timeWaited = 0;
            while (finalBuffer === null && timeWaited < 10000 && !conversionComplete) {
              await new Promise(r => setTimeout(r, 500));
              timeWaited += 500;
            }
            
            // If conversion is taking too long, we'll try again or fall back to WAV
            if (finalBuffer === null && !conversionComplete) {
              if (conversionAttempts >= maxAttempts) {
                // Fall back to WAV if MP3 conversion failed
                addLog("MP3 conversion timed out, falling back to WAV format");
                finalBuffer = wavBuffer.slice(0);
                format = 'audio/wav';
                
                // Create a WAV blob and URL
                const audioBlob = new Blob([finalBuffer], { type: format });
                setAudioFormat(format);
                const url = URL.createObjectURL(audioBlob);
                setAudioUrl(url);
                
                toast({
                  title: "Conversion complete!",
                  description: "Your audio file is ready for download (WAV format)."
                });
                
                addLog("Conversion process completed with WAV fallback");
              } else {
                addLog(`Conversion attempt ${conversionAttempts} timed out, retrying...`);
              }
            }
          } catch (conversionError) {
            addLog(`Error in audio processing: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
            if (conversionAttempts >= maxAttempts) {
              throw conversionError;
            } else {
              addLog(`Retrying conversion (attempt ${conversionAttempts + 1})`);
            }
          }
        }
      } catch (decodeError) {
        addLog(`Error decoding audio: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
        throw new Error(`Failed to decode audio from video. The format might not be supported: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error extracting audio:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during audio extraction';
      setError(errorMessage);
      addLog(`Extraction failed: ${errorMessage}`);
      toast({
        title: "Conversion failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      addLog("Process finished");
    }
  }, [addLog, toast]);

  const getOutputFileName = useCallback((fileName: string) => {
    const extension = audioFormat === 'audio/wav' ? '.wav' : '.mp3';
    return fileName.replace(/\.[^/.]+$/, extension);
  }, [audioFormat]);

  return {
    isProcessing,
    progress,
    audioUrl,
    audioFormat,
    error,
    logs,
    extractAudio,
    getOutputFileName
  };
};
