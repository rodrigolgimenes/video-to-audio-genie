
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
  const [mp3Url, setMp3Url] = useState<string | null>(null);
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
      setMp3Url(null);
      
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
        addLog("Starting audio processing with Web Worker");
        let finalBuffer: ArrayBuffer | null = null;
        
        try {
          let lastProgress = 0;
          
          while (finalBuffer === null) {
            const { mp3Buffer, progress } = await convertWavToMp3(
              wavBuffer.slice(0), // Create a copy since the worker consumes the original
              audioBuffer.numberOfChannels,
              audioBuffer.sampleRate
            );
            
            // Only add a log if progress changed significantly
            if (progress - lastProgress >= 0.1) {
              lastProgress = progress;
              addLog(`Processing progress: ${Math.round(progress * 100)}%`);
            }
            
            setProgress(progress * 100);
            
            if (progress === 1) {
              finalBuffer = mp3Buffer;
              addLog(`Processing complete (${finalBuffer.byteLength} bytes)`);
            }
          }
          
          // Step 5: Create a Blob from the processed buffer
          addLog("Creating audio Blob");
          // We're using audio/wav since we're essentially returning WAV data in the fallback mode
          // In a production app with proper MP3 encoding, you'd use audio/mpeg
          const audioBlob = new Blob([finalBuffer], { type: 'audio/wav' });
          
          // Step 6: Create a download URL
          addLog("Generating download URL");
          const url = URL.createObjectURL(audioBlob);
          setMp3Url(url);
          
          toast({
            title: "Conversion complete!",
            description: "Your audio file is ready for download."
          });
          addLog("Conversion process completed successfully");
        } catch (conversionError) {
          addLog(`Error in audio processing: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
          throw conversionError;
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
    // We're now returning WAV in the fallback implementation
    return fileName.replace(/\.[^/.]+$/, '.wav');
  }, []);

  return {
    isProcessing,
    progress,
    mp3Url,
    error,
    logs,
    extractAudio,
    getOutputFileName
  };
};
