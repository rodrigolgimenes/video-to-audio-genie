
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clipboard, Languages, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TranscriptionResult } from '@/lib/transcriptionService';

interface TranscriptionResultProps {
  result: TranscriptionResult | null;
  isLoading: boolean;
  error?: string | null;
}

const TranscriptionResult: React.FC<TranscriptionResultProps> = ({ 
  result, 
  isLoading,
  error
}) => {
  const copyToClipboard = () => {
    if (result?.text) {
      navigator.clipboard.writeText(result.text);
      toast.success("Texto copiado para a área de transferência!");
    }
  };
  
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  if (isLoading) {
    return (
      <Card className="w-full mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Transcrevendo áudio...</CardTitle>
          <CardDescription>
            Este processo pode levar alguns minutos dependendo do tamanho do arquivo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="w-full mt-4 border-destructive/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-destructive">Erro na Transcrição</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }
  
  if (!result) {
    return null;
  }
  
  return (
    <Card className="w-full mt-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Transcrição do Áudio</CardTitle>
          <Button variant="ghost" size="sm" onClick={copyToClipboard}>
            <Clipboard className="h-4 w-4 mr-1" />
            Copiar
          </Button>
        </div>
        <CardDescription className="flex items-center gap-2">
          {result.language && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Languages className="h-3 w-3" />
              {result.language}
            </Badge>
          )}
          {result.segments && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(result.segments[result.segments.length - 1]?.end || 0)}
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="full">
          <TabsList className="mb-2">
            <TabsTrigger value="full">Texto Completo</TabsTrigger>
            <TabsTrigger value="segments">Segmentos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="full">
            <ScrollArea className="h-[300px] rounded-md border p-4">
              <p className="whitespace-pre-wrap text-sm">{result.text}</p>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="segments">
            <ScrollArea className="h-[300px] rounded-md border">
              <div className="divide-y">
                {result.segments?.map((segment) => (
                  <div key={segment.id} className="p-2 hover:bg-muted/50">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(segment.start)} - {formatTime(segment.end)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Seg. {segment.id + 1}
                      </span>
                    </div>
                    <p className="text-sm">{segment.text}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Transcrição gerada com Fast Whisper
      </CardFooter>
    </Card>
  );
};

export default TranscriptionResult;
