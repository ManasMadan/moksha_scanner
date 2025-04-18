/* eslint-disable react-hooks/exhaustive-deps */
// src/components/QrcodeScanner.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

const QrcodeScanner: React.FC<QrcodeScannerProps> = ({ onScanSuccess }) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCamera, setCurrentCamera] = useState<string>('');
  const [flashOn, setFlashOn] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<string>('');
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Get available cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length) {
          setCameras(devices);
          setCurrentCamera(devices[0].id);
        }
      })
      .catch(err => {
        console.error('Error getting cameras', err);
      });
  }, []);

  // Initialize and start scanner
  useEffect(() => {
    if (!currentCamera || !scannerContainerRef.current) return;

    // Clean up previous scanner instance if exists
    const cleanupScanner = () => {
      if (scannerRef.current) {
        return scannerRef.current.stop()
          .then(() => {
            scannerRef.current = null;
          })
          .catch(err => console.error('Error stopping scanner:', err));
      }
      return Promise.resolve();
    };

    // Start new scanner instance
    const startScanner = () => {
      if (!scannerContainerRef.current) return Promise.resolve();
      
      const scanner = new Html5Qrcode('scanner-container');
      scannerRef.current = scanner;
      
      const config = {
        fps: 15, // Higher frame rate for better performance
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
        videoConstraints: {
          deviceId: currentCamera,
          facingMode: "environment",
        }
      };
      
      return scanner.start(
        currentCamera,
        config,
        (decodedText) => {
          // Avoid processing the same QR code repeatedly
          if (decodedText !== lastResult) {
            setLastResult(decodedText);
            onScanSuccess(decodedText);
          }
        },
        (errorMessage) => {
          // QR code scanning errors are handled silently for better UX
        }
      )
      .then(() => {
        setScanning(true);
        
        // Try to enable flash if requested
        if (flashOn) {
          toggleFlash(true);
        }
      })
      .catch(err => {
        console.error('Error starting scanner:', err);
      });
    };

    cleanupScanner().then(startScanner);

    return () => {
      cleanupScanner();
    };
  }, [currentCamera, flashOn, lastResult, onScanSuccess]);

  // Toggle camera flash
  const toggleFlash = (forceState?: boolean) => {
    const newState = forceState !== undefined ? forceState : !flashOn;
    
    if (scannerRef.current) {
      try {
        scannerRef.current.applyVideoConstraints({
          advanced: [{ torch: newState }]
        }).then(() => {
          setFlashOn(newState);
        }).catch(err => {
          console.error('Flash toggle error:', err);
        });
      } catch (error) {
        console.error('Error setting flash:', error);
      }
    }
    
    setFlashOn(newState);
  };

  // Switch between front and back cameras
  const switchCamera = () => {
    if (cameras.length <= 1) {
      return;
    }
    
    const currentIndex = cameras.findIndex(cam => cam.id === currentCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setCurrentCamera(cameras[nextIndex].id);
  };

  return (
    <div className="mb-6">
      {/* Scanner container */}
      <div 
        id="scanner-container" 
        ref={scannerContainerRef}
        className="w-full max-w-md mx-auto aspect-square rounded-lg overflow-hidden bg-black"
      />
      
      {/* Controls */}
      <div className="mt-6 flex justify-center gap-4">
        <button
          onClick={() => toggleFlash()}
          className={`px-4 py-2 rounded-lg ${flashOn ? 'bg-yellow-500' : 'bg-gray-700'} text-white`}
        >
          {flashOn ? 'Flash: ON' : 'Flash: OFF'}
        </button>
        
        <button
          onClick={switchCamera}
          className="px-4 py-2 rounded-lg bg-gray-700 text-white"
          disabled={cameras.length <= 1}
        >
          Switch Camera
        </button>
      </div>
    </div>
  );
};

export default QrcodeScanner;