import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

export default function FileViewer({ previewFile, onClose }: {previewFile: any, onClose: ()=> void}) {
  const { name, url, type } = previewFile;

  const renderContent = () => {
    if (type.startsWith("image/")) {
      return <img src={url} alt={name} className="max-w-full max-h-[70vh] rounded-xl" />;
    }

    if (type.startsWith("video/")) {
      return (
        <video controls className="max-w-full max-h-[70vh] rounded-xl">
          <source src={url} type={type} />
          Your browser does not support the video tag.
        </video>
      );
    }

    if (type === "application/pdf") {
      return (
        <iframe
          src={url}
          title={name}
          className="w-full h-[70vh] rounded-xl"
          allow="fullscreen"
        />
      );
    }

    return (
      <div className="text-center p-4">
        <p className="text-lg">Preview not available for this file type.</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">
          Download {name}
        </a>
      </div>
    );
  };

  return (
    <Dialog open={!!previewFile} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            {name}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center items-center p-4">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
}
