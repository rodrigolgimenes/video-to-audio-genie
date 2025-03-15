
import React, { useEffect, useRef } from 'react';
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoIcon, AlertTriangleIcon, AlertCircleIcon, FileTextIcon, ServerIcon, CodeIcon, ArrowDownIcon, TerminalIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAllLogs, LogCategory } from "@/lib/logger";

interface ConversionProgressProps {
  progress: number;
  logs?: string[];
  error?: string | null;
  isComplete?: boolean;
  audioFormat?: string | null;
  audioSize?: number | undefined;
  originalFileSize?: number | undefined;
  videoFileName?: string | null;
}

const ConversionProgress: React.FC<ConversionProgressProps> = ({ 
  progress, 
  logs, 
  error, 
  isComplete,
  audioFormat,
  audioSize,
  originalFileSize,
  videoFileName
}) => {
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Get all detailed logs from logger system
  const allSystemLogs = getAllLogs();
  
  // Auto-scroll to bottom of logs when new logs come in
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, allSystemLogs]);
  
  // Group logs by category for better organization
  const groupedLogs = allSystemLogs.reduce((acc, log) => {
    if (!acc[log.category]) {
      acc[log.category] = [];
    }
    acc[log.category].push(log);
    return acc;
  }, {} as Record<LogCategory, typeof allSystemLogs>);
  
  // Original logs passed from parent
  const generalLogs = logs?.filter(log => !log.includes('ERROR:') && !log.includes('WARNING:') && !log.includes('CRITICAL')) || [];
  const warningLogs = logs?.filter(log => log.includes('WARNING:')) || [];
  const errorLogs = logs?.filter(log => log.includes('ERROR:') || log.includes('CRITICAL')) || [];
  
  // Check if lamejs is being loaded properly
  const lamejsLogs = logs?.filter(log => 
    log.includes('lamejs') || 
    log.includes('LAMEJS') || 
    log.includes('lame.all.js')
  ) || [];
  
  const workerLogs = logs?.filter(log => log.includes('Worker:') || log.includes('WORKER LOG:')) || [];
  
  // URL related logs
  const pathLogs = logs?.filter(log => 
    log.includes('/libs/lamejs') || 
    log.includes('URL') || 
    log.includes('path') || 
    log.includes('origin')
  ) || [];

  // Environment check logs
  const envLogs = logs?.filter(log => log.includes('Environment check:')) || [];
  
  // Audio processing logs  
  const audioLogs = logs?.filter(log => 
    log.includes('audio') || 
    log.includes('Audio') || 
    log.includes('decode') || 
    log.includes('buffer') || 
    log.includes('sample')
  ) || [];

  // Encoding logs
  const encodingLogs = logs?.filter(log => 
    log.includes('encoding') || 
    log.includes('Encoding') || 
    log.includes('encode') || 
    log.includes('Encode') || 
    log.includes('chunk') || 
    log.includes('MP3')
  ) || [];
  
  // Format file size
  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return 'N/A';
    
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Calculate compression rate
  const getCompressionRate = () => {
    if (!audioSize || !originalFileSize) return 'N/A';
    const rate = ((1 - audioSize / originalFileSize) * 100).toFixed(1);
    return `${rate}%`;
  };

  // Get a summary of the conversion process
  const getConversionSummary = () => {
    // Check if MP3 was successfully created
    const mp3Success = audioFormat === 'audio/mpeg';
    
    // Check if there were worker errors
    const workerErrors = errorLogs.filter(log => log.includes('Worker')).length > 0;
    
    // Check if LameJS was loaded correctly
    const lamejsSuccess = lamejsLogs.some(log => 
      log.includes('successfully') || 
      log.includes('Success') || 
      log.includes('Available')
    );
    
    if (error) {
      return {
        title: "Falha na Conversão",
        message: "O processo encontrou erros e não foi possível completar a conversão para MP3.",
        color: "bg-destructive/10 text-destructive border-destructive/20",
        steps: [
          "❌ Inicialização do ambiente",
          lamejsSuccess ? "✅ Carregamento da biblioteca LameJS" : "❌ Falha ao carregar a biblioteca LameJS",
          workerErrors ? "❌ Falha na inicialização do Web Worker" : "✅ Web Worker inicializado",
          audioLogs.length > 0 ? "✅ Decodificação do áudio" : "❌ Falha na decodificação do áudio",
          "❌ Codificação MP3 falhou"
        ]
      };
    }
    
    if (isComplete && mp3Success) {
      return {
        title: "Conversão MP3 Bem-sucedida",
        message: "O áudio foi extraído com sucesso e comprimido no formato MP3.",
        color: "bg-green-500/10 text-green-600 border-green-500/20",
        steps: [
          "✅ Inicialização do ambiente",
          "✅ Carregamento da biblioteca LameJS",
          "✅ Web Worker inicializado",
          "✅ Decodificação do áudio do vídeo",
          "✅ Codificação MP3 finalizada"
        ]
      };
    }
    
    if (isComplete && !mp3Success) {
      return {
        title: "Conversão WAV (Fallback)",
        message: "A codificação MP3 falhou, mas o áudio foi extraído no formato WAV (sem compressão).",
        color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        steps: [
          "✅ Inicialização do ambiente",
          "❌ Problema no carregamento do LameJS",
          "❌ Codificação MP3 falhou",
          "✅ Fallback para WAV executado",
          "✅ Extração de áudio concluída (sem compressão)"
        ]
      };
    }
    
    return {
      title: "Processando...",
      message: "A conversão está em andamento.",
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      steps: [
        envLogs.length > 0 ? "✅ Inicialização do ambiente" : "⏳ Inicializando ambiente",
        lamejsLogs.length > 0 ? (lamejsSuccess ? "✅ Carregamento da biblioteca LameJS" : "❌ Problema no carregamento do LameJS") : "⏳ Carregando biblioteca LameJS",
        workerLogs.length > 0 ? "✅ Web Worker inicializado" : "⏳ Inicializando Web Worker",
        audioLogs.length > 0 ? "✅ Decodificação do áudio" : "⏳ Decodificando áudio do vídeo",
        encodingLogs.length > 0 ? "⏳ Codificando MP3..." : "Aguardando codificação MP3"
      ]
    };
  };
  
  const summary = getConversionSummary();
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm font-medium">{isComplete ? "Conversão concluída" : "Convertendo..."}</span>
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      
      {isComplete && (
        <Card className={`border ${summary.color}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{summary.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{summary.message}</p>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Arquivo original:</span>
                <span className="font-medium">{videoFileName || "desconhecido"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Tamanho original:</span>
                <span className="font-medium">{formatFileSize(originalFileSize)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Formato de saída:</span>
                <span className="font-medium">{audioFormat === 'audio/mpeg' ? 'MP3 (comprimido)' : 'WAV (não comprimido)'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Tamanho final:</span>
                <span className="font-medium">{formatFileSize(audioSize)}</span>
              </div>
              <div className="flex flex-col col-span-2">
                <span className="text-muted-foreground">Taxa de compressão:</span>
                <span className="font-medium">{getCompressionRate()}</span>
              </div>
            </div>
            
            <div className="space-y-1 mt-2 border-t pt-2">
              <div className="text-sm font-medium">Fluxo de processamento:</div>
              <ol className="list-none space-y-1 text-xs">
                {summary.steps.map((step, index) => (
                  <li key={index} className="flex items-center">
                    <span className="font-mono mr-1">{index + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
      
      {error && (
        <Alert variant="destructive" className="my-2">
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
      )}
      
      {/* NEW SECTION: Detailed Process Logs */}
      <Accordion type="single" collapsible className="w-full" defaultValue="item-0">
        <AccordionItem value="item-0">
          <AccordionTrigger className="text-sm font-medium flex items-center">
            <TerminalIcon className="h-4 w-4 mr-2" />
            Logs do Processo de Conversão
          </AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-[300px] rounded-md border p-2 bg-muted/20">
              <div className="space-y-1 font-mono text-xs">
                {allSystemLogs.map((log, i) => (
                  <div key={`syslog-${i}`} className={`
                    ${log.category === 'ERROR' ? 'text-red-500' : ''}
                    ${log.category === 'WARN' ? 'text-yellow-500' : ''}
                    ${log.category === 'LAMEJS' ? 'text-purple-500' : ''}
                    ${log.category === 'WORKER' ? 'text-blue-500' : ''}
                    ${log.category === 'USER' ? 'font-semibold text-green-600' : ''}
                  `}>
                    {log.timestamp.split('T')[1].split('.')[0]} [{log.category}] {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      {/* Original diagnostic logs UI */}
      {logs && logs.length > 0 && (
        <Accordion type="single" collapsible className="w-full" defaultValue={isComplete ? "item-2" : "item-1"}>
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-sm font-medium">
              Logs de Diagnóstico ({logs.length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="text-xs font-mono">
                <div className="mb-3">
                  <div className="font-medium text-sm mb-1 text-amber-500 flex items-center">
                    <ServerIcon className="h-4 w-4 mr-1" /> Status LameJS:
                  </div>
                  <div className="bg-muted rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto">
                    {groupedLogs['LAMEJS'] && groupedLogs['LAMEJS'].length > 0 ? (
                      groupedLogs['LAMEJS'].map((log, i) => (
                        <div key={`lamejs-${i}`} className={`${log.message.includes('ERROR') || log.message.includes('CRITICAL') || log.message.includes('FAILED') ? 'text-red-500' : log.message.includes('WARNING') ? 'text-yellow-500' : 'text-green-500'}`}>
                          {log.timestamp.split('T')[1].split('.')[0]} - {log.message}
                        </div>
                      ))
                    ) : (
                      lamejsLogs.length > 0 ? (
                        lamejsLogs.map((log, i) => (
                          <div key={`lamejs-${i}`} className={`${log.includes('ERROR') || log.includes('CRITICAL') || log.includes('FAILED') ? 'text-red-500' : log.includes('WARNING') ? 'text-yellow-500' : 'text-green-500'}`}>
                            {log}
                          </div>
                        ))
                      ) : (
                        <div className="text-red-500">Nenhum log do LameJS encontrado!</div>
                      )
                    )}
                  </div>
                </div>
                
                <div className="mb-3">
                  <div className="font-medium text-sm mb-1 text-blue-500 flex items-center">
                    <CodeIcon className="h-4 w-4 mr-1" /> Status do Worker:
                  </div>
                  <div className="bg-muted rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto">
                    {groupedLogs['WORKER'] && groupedLogs['WORKER'].length > 0 ? (
                      groupedLogs['WORKER'].map((log, i) => (
                        <div key={`worker-${i}`} className={`${log.message.includes('ERROR') || log.message.includes('CRITICAL') || log.message.includes('FAILED') ? 'text-red-500' : log.message.includes('WARNING') ? 'text-yellow-500' : ''}`}>
                          {log.timestamp.split('T')[1].split('.')[0]} - {log.message}
                        </div>
                      ))
                    ) : (
                      workerLogs.length > 0 ? (
                        workerLogs.map((log, i) => (
                          <div key={`worker-${i}`} className={`${log.includes('ERROR') || log.includes('CRITICAL') || log.includes('FAILED') ? 'text-red-500' : log.includes('WARNING') ? 'text-yellow-500' : ''}`}>
                            {log}
                          </div>
                        ))
                      ) : (
                        <div className="text-yellow-500">Nenhum log do Worker encontrado!</div>
                      )
                    )}
                  </div>
                </div>
                
                <div className="mb-3">
                  <div className="font-medium text-sm mb-1 text-purple-500 flex items-center">
                    <FileTextIcon className="h-4 w-4 mr-1" /> Processamento de Dados de Áudio:
                  </div>
                  <div className="bg-muted rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto">
                    {groupedLogs['DATA'] && groupedLogs['DATA'].length > 0 ? (
                      groupedLogs['DATA'].map((log, i) => (
                        <div key={`data-${i}`} className={`${log.message.includes('ERROR') || log.message.includes('CRITICAL') || log.message.includes('FAILED') ? 'text-red-500' : log.message.includes('WARNING') ? 'text-yellow-500' : ''}`}>
                          {log.timestamp.split('T')[1].split('.')[0]} - {log.message}
                        </div>
                      ))
                    ) : (
                      <div className="text-yellow-500">Nenhum log de processamento de dados encontrado!</div>
                    )}
                  </div>
                </div>
                
                <div className="mb-3">
                  <div className="font-medium text-sm mb-1 text-green-500 flex items-center">
                    <FileTextIcon className="h-4 w-4 mr-1" /> Validação de Formato:
                  </div>
                  <div className="bg-muted rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto">
                    {groupedLogs['FORMAT'] && groupedLogs['FORMAT'].length > 0 ? (
                      groupedLogs['FORMAT'].map((log, i) => (
                        <div key={`format-${i}`} className={`${log.message.includes('ERROR') || log.message.includes('CRITICAL') || log.message.includes('FAILED') ? 'text-red-500' : log.message.includes('WARNING') ? 'text-yellow-500' : ''}`}>
                          {log.timestamp.split('T')[1].split('.')[0]} - {log.message}
                        </div>
                      ))
                    ) : (
                      <div className="text-yellow-500">Nenhum log de validação de formato encontrado!</div>
                    )}
                  </div>
                </div>
                
                {groupedLogs['ERROR'] && groupedLogs['ERROR'].length > 0 && (
                  <div className="mb-3">
                    <div className="font-medium text-sm mb-1 text-red-500 flex items-center">
                      <AlertCircleIcon className="h-4 w-4 mr-1" /> Erros:
                    </div>
                    <div className="bg-red-950/20 text-red-500 rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto">
                      {groupedLogs['ERROR'].map((log, i) => (
                        <div key={`error-${i}`}>{log.timestamp.split('T')[1].split('.')[0]} - {log.message}</div>
                      ))}
                    </div>
                  </div>
                )}
                
                {groupedLogs['WARN'] && groupedLogs['WARN'].length > 0 && (
                  <div className="mb-3">
                    <div className="font-medium text-sm mb-1 text-yellow-500 flex items-center">
                      <AlertTriangleIcon className="h-4 w-4 mr-1" /> Avisos:
                    </div>
                    <div className="bg-yellow-950/20 text-yellow-500 rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto">
                      {groupedLogs['WARN'].map((log, i) => (
                        <div key={`warning-${i}`}>{log.timestamp.split('T')[1].split('.')[0]} - {log.message}</div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="mb-3">
                  <div className="font-medium text-sm mb-1 flex items-center">
                    <InfoIcon className="h-4 w-4 mr-1" /> Todos os Logs:
                  </div>
                  <div className="bg-muted rounded-md p-2 overflow-x-auto max-h-60 overflow-y-auto">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">#</TableHead>
                          <TableHead className="w-24">Hora</TableHead>
                          <TableHead className="w-24">Categoria</TableHead>
                          <TableHead>Mensagem de Log</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log, index) => (
                          <TableRow key={index} className={`${log.includes('ERROR') || log.includes('CRITICAL') ? 'text-red-500' : log.includes('WARNING') ? 'text-yellow-500' : ''}`}>
                            <TableCell className="py-1">{index + 1}</TableCell>
                            <TableCell className="py-1">{log.split(' ')[0]}</TableCell>
                            <TableCell className="py-1">{log.includes('ERROR') ? 'ERROR' : log.includes('WARNING') ? 'WARN' : 'INFO'}</TableCell>
                            <TableCell className="py-1 font-mono whitespace-pre-wrap break-all">{log.split(' ').slice(1).join(' ')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
          
          {isComplete && (
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-sm font-medium">
                Relatório Técnico
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 text-sm">
                  <div className="space-y-2">
                    <h3 className="font-medium">Resumo da Conversão</h3>
                    <p>
                      {audioFormat === 'audio/mpeg' ? 
                        'A conversão para MP3 foi realizada com sucesso.' : 
                        'A conversão MP3 falhou e foi utilizado o formato WAV como alternativa.'}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant={audioFormat === 'audio/mpeg' ? "default" : "secondary"}>
                        {audioFormat === 'audio/mpeg' ? 'MP3' : 'WAV'}
                      </Badge>
                      <Badge variant="outline">{formatFileSize(audioSize)}</Badge>
                      <Badge variant="outline">Compressão: {getCompressionRate()}</Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">Verificação de Ambiente</h3>
                    <div className="grid grid-cols-1 gap-1 text-sm">
                      <div className="flex items-center">
                        <span className={`h-2 w-2 rounded-full ${lamejsLogs.some(log => log.includes('Success') || log.includes('successful')) ? 'bg-green-500' : 'bg-red-500'} mr-2`}></span>
                        <span>Biblioteca LameJS: {lamejsLogs.some(log => log.includes('Success') || log.includes('successful')) ? 'Carregada' : 'Falha no carregamento'}</span>
                      </div>
                      <div className="flex items-center">
                        <span className={`h-2 w-2 rounded-full ${workerLogs.length > 0 ? 'bg-green-500' : 'bg-red-500'} mr-2`}></span>
                        <span>Web Worker: {workerLogs.length > 0 ? 'Inicializado' : 'Não inicializado'}</span>
                      </div>
                      <div className="flex items-center">
                        <span className={`h-2 w-2 rounded-full ${audioLogs.length > 0 ? 'bg-green-500' : 'bg-red-500'} mr-2`}></span>
                        <span>Decodificação de áudio: {audioLogs.length > 0 ? 'Realizada' : 'Falha'}</span>
                      </div>
                      <div className="flex items-center">
                        <span className={`h-2 w-2 rounded-full ${pathLogs.some(log => log.includes('200 OK') || log.includes('accessible')) ? 'bg-green-500' : 'bg-yellow-500'} mr-2`}></span>
                        <span>Acesso aos arquivos: {pathLogs.some(log => log.includes('200 OK') || log.includes('accessible')) ? 'OK' : 'Verificar caminhos'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">Instruções para Solução de Problemas</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                      <li>Verifique se o worker é um Worker clássico (<code>new Worker(url)</code>), não um Worker de módulo ES.</li>
                      <li>Verifique se não há declarações <code>return</code> ou <code>export</code> no nível superior do código do Worker.</li>
                      <li>Confirme se o caminho <code>importScripts('/libs/lamejs/lame.all.js')</code> está correto.</li>
                      <li>Verifique se o Worker realmente chama <code>lamejs.Mp3Encoder</code> para codificação.</li>
                      <li>Use uma taxa de bits mais baixa para um arquivo MP3 menor (64 kbps para máxima compressão).</li>
                      <li>Verifique erros no console do navegador, especialmente relacionados ao carregamento do LameJS.</li>
                    </ol>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      )}
    </div>
  );
};

export default ConversionProgress;
