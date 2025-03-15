
// This is a mock implementation for demonstration purposes
// In a production environment, you would connect to your actual fast-whisper server

import { logConverter } from './logger';

// Simulates processing delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const handleTranscriptionRequest = async (audioBlob: Blob) => {
  logConverter('Mock API: Recebendo solicitação de transcrição');
  logConverter(`Mock API: Tamanho do arquivo de áudio: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`);
  
  // Simulating server processing time (scaled based on file size)
  const processingTime = Math.min(5000, 1000 + audioBlob.size / 100000);
  logConverter(`Mock API: Tempo estimado de processamento: ${processingTime}ms`);
  
  await delay(processingTime);
  
  logConverter('Mock API: Processamento concluído, gerando resposta');
  
  // In a real implementation, this would be the actual transcription from fast-whisper
  return {
    text: "Este é um exemplo de transcrição gerada pelo fast-whisper. Em um ambiente de produção, este texto seria o resultado real da transcrição do seu arquivo de áudio. O fast-whisper é uma implementação otimizada do modelo Whisper da OpenAI, projetado para transcrição de fala para texto com alta precisão.",
    language: "pt",
    segments: [
      {
        id: 0,
        start: 0.0,
        end: 3.5,
        text: "Este é um exemplo de transcrição gerada pelo fast-whisper."
      },
      {
        id: 1,
        start: 3.5,
        end: 8.2,
        text: "Em um ambiente de produção, este texto seria o resultado real da transcrição do seu arquivo de áudio."
      },
      {
        id: 2,
        start: 8.2,
        end: 15.0,
        text: "O fast-whisper é uma implementação otimizada do modelo Whisper da OpenAI, projetado para transcrição de fala para texto com alta precisão."
      }
    ]
  };
};
