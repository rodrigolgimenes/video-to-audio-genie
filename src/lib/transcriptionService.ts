
import { log, logConverter } from './logger';

export type TranscriptionResult = {
  text: string;
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  language?: string;
};

// Update the backend URL to point to your actual fast-whisper service
const FAST_WHISPER_API_URL = import.meta.env.VITE_FAST_WHISPER_API_URL || 'https://whisper-api.lovable.dev/asr';

export const transcribeAudio = async (
  audioBlob: Blob, 
  onProgress?: (message: string) => void
): Promise<TranscriptionResult> => {
  try {
    logConverter('Iniciando processo de transcrição com fast-whisper');
    
    if (onProgress) {
      onProgress('Preparando áudio para transcrição...');
    }
    
    // Create a FormData object with the audio blob
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');
    formData.append('model', 'base'); // Using base model for faster processing
    
    logConverter(`Arquivo de áudio preparado: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`);
    
    if (onProgress) {
      onProgress('Enviando áudio para servidor fast-whisper...');
      onProgress(`Endpoint da API: ${FAST_WHISPER_API_URL}`);
    }
    
    // Send request to the actual fast-whisper API endpoint
    logConverter(`Enviando requisição para ${FAST_WHISPER_API_URL}`);
    const response = await fetch(FAST_WHISPER_API_URL, {
      method: 'POST',
      body: formData,
      // Add CORS headers to support cross-origin requests
      mode: 'cors',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha na transcrição: ${response.status} - ${errorText}`);
    }
    
    logConverter('Resposta recebida do servidor fast-whisper, processando resultado');
    
    if (onProgress) {
      onProgress('Processando resultado da transcrição...');
    }
    
    const rawResult = await response.json();
    
    // Transform API result to match our expected format if needed
    // Fast-whisper typically returns results in this format, but we'll handle transformation if needed
    const result: TranscriptionResult = {
      text: rawResult.text || '',
      language: rawResult.language || 'pt',
      segments: Array.isArray(rawResult.segments) 
        ? rawResult.segments.map((segment: any, index: number) => ({
            id: index,
            start: segment.start || 0,
            end: segment.end || 0,
            text: segment.text || ''
          }))
        : []
    };
    
    // Log success information
    logConverter(`Transcrição concluída com sucesso: ${result.text.length} caracteres`);
    logConverter(`Idioma detectado: ${result.language || 'não detectado'}`);
    logConverter(`Número de segmentos: ${result.segments?.length || 0}`);
    
    return result;
  } catch (error) {
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    logConverter(`ERRO na transcrição: ${errorMessage}`);
    throw new Error(`Falha na transcrição: ${errorMessage}`);
  }
};
