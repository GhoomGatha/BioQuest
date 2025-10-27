
import React, { useRef, useEffect, useState, useCallback } from 'react';
import Modal from './Modal';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cleanupStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(mediaStream => {
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        })
        .catch(err => {
          console.error("Error accessing camera:", err);
          setError("Could not access the camera. Please check your browser permissions.");
        });
    } else {
      cleanupStream();
    }

    return () => {
      cleanupStream();
    };
  }, [isOpen, cleanupStream]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) {
            const file = new File([blob], "capture.png", { type: "image/png" });
            onCapture(file);
          }
        }, 'image/png');
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Take a Photo">
      <div className="flex flex-col items-center">
        {error ? (
          <p className="text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>
        ) : (
          <>
            <div className="relative w-full max-w-md bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} autoPlay playsInline className="w-full h-auto" />
                <div className="absolute inset-0 border-4 border-white/30 rounded-lg pointer-events-none"></div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <button
              onClick={handleCapture}
              disabled={!stream}
              className="mt-4 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-full shadow-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition-all transform hover:scale-105"
            >
              Capture
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default CameraModal;