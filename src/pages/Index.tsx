
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Volume2 } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/30 p-4">
      <div className="text-center space-y-6 max-w-xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Video to Audio Genie</h1>
        <p className="text-xl text-muted-foreground">
          Extract high-quality audio from your videos directly in your browser.
          No uploads needed, everything happens on your device.
        </p>
        
        <div className="pt-4">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link to="/audio-extractor">
              <Volume2 className="mr-2 h-5 w-5" />
              Start Converting
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
          <div className="bg-card p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2">Privacy First</h3>
            <p className="text-muted-foreground">Your files never leave your device. All conversion happens locally.</p>
          </div>
          
          <div className="bg-card p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2">High Quality</h3>
            <p className="text-muted-foreground">Extract MP3 audio while preserving the original quality.</p>
          </div>
          
          <div className="bg-card p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2">Easy to Use</h3>
            <p className="text-muted-foreground">Simple drag-and-drop interface with no complicated settings.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
