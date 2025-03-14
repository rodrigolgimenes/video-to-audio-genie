
import React from 'react';
import { Progress } from "@/components/ui/progress";

interface ConversionProgressProps {
  progress: number;
  logs?: string[];
}

const ConversionProgress: React.FC<ConversionProgressProps> = ({ progress, logs }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm">Converting...</span>
          <span className="text-sm">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      
      {logs && logs.length > 0 && (
        <div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Show processing logs</summary>
            <div className="mt-2 p-3 bg-muted rounded-md overflow-y-auto max-h-40">
              {logs.map((log, index) => (
                <div key={index} className="font-mono">{log}</div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default ConversionProgress;
