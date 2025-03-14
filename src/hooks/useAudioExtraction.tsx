
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
        let format = 'audio/mpeg'; // Default to MP3
        
        while (finalBuffer === null && conversionAttempts < maxAttempts) {
          conversionAttempts++;
          
          try {
            // Progress update handler
            const handleProgressUpdate = ({ mp3Buffer, progress, format: workerFormat }: { 
              mp3Buffer: ArrayBuffer, 
              progress: number, 
              format?: string 
            }) => {
              setProgress(progress * 100);
              
              // Only log significant progress changes
              if (Math.floor(progress * 10) % 2 === 0) {
                addLog(`Processing progress: ${Math.round(progress * 100)}%`);
              }
              
              // When complete, update the audio URL
              if (progress === 1 && mp3Buffer.byteLength > 0) {
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
                  description: `Your audio file is ready for download as ${format === 'audio/mpeg' ? 'MP3' : 'WAV'}.`
                });
                
                addLog("Conversion process completed successfully");
                setIsProcessing(false);
                return true;
              }
              return false;
            };
            
            // Start the conversion process
            addLog(`Starting conversion attempt ${conversionAttempts}`);
            
            try {
              // Create a copy of the WAV buffer for this attempt
              const wavBufferCopy = wavBuffer.slice(0);
              
              // Start the conversion with a timeout
              let conversionTimeout: NodeJS.Timeout | null = null;
              
              const conversionPromise = new Promise<boolean>((resolve, reject) => {
                // Set a timeout to cancel this attempt if it takes too long
                conversionTimeout = setTimeout(() => {
                  reject(new Error("Conversion timed out"));
                }, 60000); // 60 seconds timeout
                
                convertWavToMp3(
                  wavBufferCopy,
                  audioBuffer.numberOfChannels,
                  audioBuffer.sampleRate
                )
                  .then(result => {
                    if (conversionTimeout) {
                      clearTimeout(conversionTimeout);
                      conversionTimeout = null;
                    }
                    const isComplete = handleProgressUpdate(result);
                    resolve(isComplete);
                  })
                  .catch(error => {
                    if (conversionTimeout) {
                      clearTimeout(conversionTimeout);
                      conversionTimeout = null;
                    }
                    reject(error);
                  });
              });
              
              const isComplete = await conversionPromise;
              
              if (isComplete) {
                break; // Exit the retry loop if conversion was successful
              }
            } catch (innerError) {
              const errorMessage = innerError instanceof Error ? innerError.message : 'Unknown conversion error';
              addLog(`Conversion error: ${errorMessage}`);
              
              if (conversionAttempts >= maxAttempts) {
                addLog("Maximum conversion attempts reached, falling back to WAV format");
                
                // Fall back to WAV if MP3 conversion failed
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
                setIsProcessing(false);
              } else {
                addLog(`Retrying conversion (attempt ${conversionAttempts + 1} of ${maxAttempts})`);
              }
            }
          } catch (conversionError) {
            addLog(`Error in audio processing: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
            
            if (conversionAttempts >= maxAttempts) {
              throw conversionError;
            } else {
              addLog(`Retrying conversion (attempt ${conversionAttempts + 1} of ${maxAttempts})`);
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
