
import React, { useRef, useEffect, useState } from 'react';
// @ts-ignore
import jsQR from 'jsqr';

interface ScannerModalProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let animationFrame: number;
    let stream: MediaStream;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          requestAnimationFrame(tick);
        }
      } catch (err) {
        setError("Could not access camera. Please check permissions.");
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.height = videoRef.current.videoHeight;
            canvas.width = videoRef.current.videoWidth;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            if (code) {
              onScan(code.data);
              return;
            }
          }
        }
      }
      animationFrame = requestAnimationFrame(tick);
    };

    startCamera();

    return () => {
      cancelAnimationFrame(animationFrame);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm relative aspect-square bg-gray-900 rounded-2xl overflow-hidden border-2 border-primary shadow-2xl">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Scanning indicator */}
        <div className="absolute inset-0 border-2 border-white/20 flex items-center justify-center pointer-events-none">
           <div className="w-48 h-48 border-2 border-primary rounded-xl animate-pulse"></div>
        </div>
      </div>
      
      {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
      
      <p className="text-white text-sm mt-8 mb-8 text-center px-6 opacity-80">
        Align your partner's QR code within the frame to sync your finances.
      </p>

      <button onClick={onClose} className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold transition-all">
        Cancel
      </button>
    </div>
  );
};
