
import { useState, useCallback } from 'react';
import { convertAudioBufferToWav, convertAudioBufferToMp3, createLogger } from '../lib/audioConverter';
import { log as globalLog } from '../lib/logger';

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
        
        // Step 4: Try to convert to MP3 first
        try {
          logger(`Starting MP3 conversion (quality: ${quality}kbps)`);
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
          logger(`MP3 conversion successful: ${blob.size} bytes`);
          
        } catch (mp3Error) {
          logger(`MP3 conversion failed: ${mp3Error.message}`);
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
          logger(`WAV fallback successful: ${blob.size} bytes`);
        }
        
      } catch (decodeError) {
        throw new Error(`Failed to decode audio data: ${decodeError.message}`);
      }
      
    } catch (error) {
      setError(`Erro na conversão: ${error.message}`);
      addLog(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [addLog]);

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
