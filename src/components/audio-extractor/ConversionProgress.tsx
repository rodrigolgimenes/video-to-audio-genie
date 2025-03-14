
import React from 'react';
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ConversionProgressProps {
  progress: number;
  logs?: string[];
  error?: string | null;
}

const ConversionProgress: React.FC<ConversionProgressProps> = ({ progress, logs, error }) => {
  // Group logs by type to organize them better
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
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm font-medium">Converting...</span>
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      
      {error && (
        <Alert variant="destructive" className="my-2">
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
      )}
      
      {logs && logs.length > 0 && (
        <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-sm font-medium">
              Debug Logs ({logs.length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="text-xs font-mono">
                <div className="mb-3">
                  <div className="font-medium text-sm mb-1 text-amber-500">LameJS Status:</div>
                  <div className="bg-muted rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto">
                    {lamejsLogs.length > 0 ? (
                      lamejsLogs.map((log, i) => (
                        <div key={`lamejs-${i}`} className={`${log.includes('ERROR') || log.includes('CRITICAL') || log.includes('FAILED') ? 'text-red-500' : log.includes('WARNING') ? 'text-yellow-500' : 'text-green-500'}`}>
                          {log}
                        </div>
                      ))
                    ) : (
                      <div className="text-red-500">No LameJS logs found!</div>
                    )}
                  </div>
                </div>
                
                <div className="mb-3">
                  <div className="font-medium text-sm mb-1 text-blue-500">Worker Status:</div>
                  <div className="bg-muted rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto">
                    {workerLogs.length > 0 ? (
                      workerLogs.map((log, i) => (
                        <div key={`worker-${i}`} className={`${log.includes('ERROR') || log.includes('CRITICAL') || log.includes('FAILED') ? 'text-red-500' : log.includes('WARNING') ? 'text-yellow-500' : ''}`}>
                          {log}
                        </div>
                      ))
                    ) : (
                      <div className="text-yellow-500">No Worker logs found!</div>
                    )}
                  </div>
                </div>
                
                <div className="mb-3">
                  <div className="font-medium text-sm mb-1 text-purple-500">Path & URL Info:</div>
                  <div className="bg-muted rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto">
                    {pathLogs.length > 0 ? (
                      pathLogs.map((log, i) => (
                        <div key={`path-${i}`} className={`${log.includes('ERROR') || log.includes('CRITICAL') || log.includes('FAILED') ? 'text-red-500' : log.includes('WARNING') ? 'text-yellow-500' : ''}`}>
                          {log}
                        </div>
                      ))
                    ) : (
                      <div className="text-yellow-500">No path or URL logs found!</div>
                    )}
                  </div>
                </div>
                
                {errorLogs.length > 0 && (
                  <div className="mb-3">
                    <div className="font-medium text-sm mb-1 text-red-500">Errors:</div>
                    <div className="bg-red-950/20 text-red-500 rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto">
                      {errorLogs.map((log, i) => (
                        <div key={`error-${i}`}>{log}</div>
                      ))}
                    </div>
                  </div>
                )}
                
                {warningLogs.length > 0 && (
                  <div className="mb-3">
                    <div className="font-medium text-sm mb-1 text-yellow-500">Warnings:</div>
                    <div className="bg-yellow-950/20 text-yellow-500 rounded-md p-2 overflow-x-auto max-h-32 overflow-y-auto">
                      {warningLogs.map((log, i) => (
                        <div key={`warning-${i}`}>{log}</div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="mb-3">
                  <div className="font-medium text-sm mb-1">All Logs:</div>
                  <div className="bg-muted rounded-md p-2 overflow-x-auto max-h-60 overflow-y-auto">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">#</TableHead>
                          <TableHead>Log Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log, index) => (
                          <TableRow key={index} className={`${log.includes('ERROR') || log.includes('CRITICAL') ? 'text-red-500' : log.includes('WARNING') ? 'text-yellow-500' : ''}`}>
                            <TableCell className="py-1">{index + 1}</TableCell>
                            <TableCell className="py-1 font-mono whitespace-pre-wrap break-all">{log}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};

export default ConversionProgress;
