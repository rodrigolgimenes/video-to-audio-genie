
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
        let finalBuffer: ArrayBuffer | null = null;
        let format = 'audio/mpeg';
        
        try {
          let lastProgress = 0;
          
          while (finalBuffer === null) {
            const { mp3Buffer, progress, format: workerFormat } = await convertWavToMp3(
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
              if (workerFormat) {
                format = workerFormat;
              }
              addLog(`Processing complete (${finalBuffer.byteLength} bytes) as ${format}`);
            }
          }
          
          // Step 5: Create a Blob from the processed buffer
          addLog("Creating audio Blob");
          const audioBlob = new Blob([finalBuffer], { type: format });
          setAudioFormat(format);
          
          // Step 6: Create a download URL
          addLog("Generating download URL");
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          
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
