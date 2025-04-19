// src/app/page.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// Constants for colors and sounds
const SUCCESS_COLOR = '#22c55e'; // Green
const ERROR_COLOR = '#ef4444'; // Red

export default function QRScannerPage() {
  // State for UI elements
  const [statusMessage, setStatusMessage] = useState<string>('Press Scan to capture QR code');
  const [cameras, setCameras] = useState<Array<{id: string, label: string}>>([]);
  const [currentCamera, setCurrentCamera] = useState<string>('');
const [isProcessingState, setIsProcessingState] = useState<boolean>(false);
const [isReadyToScanState, setIsReadyToScanState] = useState<boolean>(false);
  const [scannerBackgroundColor, setScannerBackgroundColor] = useState<string>('transparent');
  
  // References
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const colorFlashTimerRef = useRef<NodeJS.Timeout | null>(null);
  const qrCodeRef = useRef<string | null>(null);
  const isReadyToScanRef = useRef<boolean>(false);
const isProcessingRef = useRef<boolean>(false);
const setIsReadyToScan = (value: boolean) => {
  isReadyToScanRef.current = value;
  setIsReadyToScanState(value); // Rename original state setter
};

const setIsProcessing = (value: boolean) => {
  isProcessingRef.current = value;
  setIsProcessingState(value); // Rename original state setter
};

  // Initialize scanner and cameras when component mounts
  useEffect(() => {
    // Check if we're in browser environment
    if (typeof window === 'undefined') return;
    
    // Get available cameras
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length) {
          setCameras(devices);
          setCurrentCamera(devices[0].id);
        }
      })
      .catch(err => {
        console.error('Error getting cameras:', err);
        setStatusMessage('Camera access error');
      });
    
    // Cleanup function
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      if (colorFlashTimerRef.current) {
        clearTimeout(colorFlashTimerRef.current);
      }
    };
  }, []);
  
  // Start camera preview when currentCamera changes
  useEffect(() => {
    if (!currentCamera || !containerRef.current) return;
    
    // Stop previous scanner if exists
    if (scannerRef.current) {
      scannerRef.current.stop()
        .then(startCameraPreview)
        .catch(console.error);
    } else {
      startCameraPreview();
    }
    
   function startCameraPreview() {
  try {
    // Create scanner instance
    const scanner = new Html5Qrcode('qr-scanner-container');
    scannerRef.current = scanner;
    
    // Configure scanner with proper orientation handling
    const config = {
      fps: 10,
      qrbox: { width: 350, height: 350 },
      aspectRatio: 1.0, // Use 1.0 instead of screen ratio
      // Add video constraints for proper orientation
      videoConstraints: {
        facingMode: "environment",
        width: { ideal: window.innerHeight },
        height: { ideal: window.innerWidth }
      }
    };
    
    // Start scanner but don't process codes yet
    scanner.start(
      currentCamera, 
      config,
      (decodedText) => {
        console.log(decodedText);
        qrCodeRef.current = decodedText;
        if (isReadyToScanRef.current && !isProcessingRef.current) {
          console.log("Processing QR code:", decodedText);
          processQRData(decodedText);
        }
      },
      () => {} // Silent error handling for better UX
    )
    .then(() => {
      setStatusMessage('Press Scan to capture QR code');
      
      
    })
    .catch(err => {
      console.error('Scanner start error:', err);
      setStatusMessage('Failed to start camera');
    });
  } catch (err) {
    console.error('Scanner initialization error:', err);
    setStatusMessage('Camera initialization failed');
  }
}
  }, [currentCamera]);
  
  // Handle scan button click - set ready to scan flag
  const handleScanButtonClick = () => {
    if (isProcessingState) return;

    setIsProcessing(false);
    setIsReadyToScan(true);
    setStatusMessage('Capturing...');
  };
  

  // Process the QR code data - sending the payload directly
const processQRData = async (data: string) => {
  try {
    // Set processing flag to prevent new scans
    setIsReadyToScan(false);
    setIsProcessing(true);
    
    // Clear any previous reset timer
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    
    // Set scanning message
    setStatusMessage('Processing check-in...');
      
      // Make API request with the direct QR payload
      const response = await fetch(process.env.NEXT_PUBLIC_CHECK_IN_URL!, {
        method: "POST",
        headers: {
          "accept": "application/json, text/plain, */*",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache, no-store, must-revalidate",
          "pragma": "no-cache",
          "expires": "0",
          "content-type": "application/json",
          "cookie": "token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL3BpLmxvY2FsOjgxMjMvYXV0aC9sb2dpbiIsImlhdCI6MTc0NDk4MDAxMCwiZXhwIjoxNzQ1NTg0ODEwLCJuYmYiOjE3NDQ5ODAwMTAsImp0aSI6IlhPVzdhdjlSTzc4bmo0b1EiLCJzdWIiOiIxIiwicHJ2IjoiYjViMWFmMWFlZjUxZTIyZTVjYmUzOTRjMzc0NTcyMmFiODBhZDZjYyIsImFjY291bnRfaWQiOjF9.wj4SqJP7FrhPPzgv4nz4zo93luOwJXyY_FXupIulHSc",
          "Referer": "https://pi.local/",
        },
        body: JSON.stringify({
          "attendees": [
            {
              "public_id": data, // Sending raw QR payload directly
              "action": "check-in"
            }
          ]
        }),
      });
      
    const result = await response.json();
    
    // Handle success or various error cases
    if (result.data && Array.isArray(result.data) && result.data.length > 0 && !result.errors) {
      setStatusMessage('Check-in successful!');
      flashBackground(SUCCESS_COLOR);
      successBeep();
          }      // Check for "Invalid attendee code detected" message
      else if (result.message && result.message.includes("Invalid attendee code")) {
        setStatusMessage('Invalid attendee code!');
        flashBackground(ERROR_COLOR);
        errorBeep();
      }
      // Check for other errors
      else if (result.errors && Object.keys(result.errors).length > 0) {
        // Already checked in or other errors
        const errorKey = Object.keys(result.errors)[0];
        const errorMessage = result.errors[errorKey] || 'Already checked in';
        setStatusMessage(`Error: ${errorMessage}`);
        flashBackground(ERROR_COLOR);
        errorBeep();
      } 
      // Generic error handling
      else {
        setStatusMessage('Error processing check-in!');
        flashBackground(ERROR_COLOR);
        errorBeep();
      }

    setIsProcessing(false);
      
    } catch (error) {
      console.error('Processing error:', error);
      setStatusMessage('Error processing QR code!');
      flashBackground(ERROR_COLOR);
      errorBeep();
      
    }
  };

    // Flash the background and reset to normal
  const flashBackground = (color: string) => {
    setScannerBackgroundColor(color);
    
    // Clear any existing timer
    if (colorFlashTimerRef.current) {
      clearTimeout(colorFlashTimerRef.current);
    }
    
    // Reset background after 2 seconds
    colorFlashTimerRef.current = setTimeout(() => {
      setScannerBackgroundColor('transparent');
      setStatusMessage("Press Scan to capture QR code")
    }, 2000);
  };
  
  
 // Play success beep
const successBeep = () => {
 try {
   const context = new (window.AudioContext || (window as any).webkitAudioContext)();
   const gainNode = context.createGain();
   gainNode.gain.value = 4; // Increased volume (0.5 instead of default)
   
   const oscillator = context.createOscillator();
   oscillator.type = 'sine';
   oscillator.frequency.value = 1000;
   oscillator.connect(gainNode);
   gainNode.connect(context.destination);
   
   oscillator.start();
   setTimeout(() => {
     oscillator.stop();
     context.close();
   }, 150);
 } catch (error) {
   console.error('Audio error:', error);
 }
};

// Play error beep
const errorBeep = () => {
 try {
   const context = new (window.AudioContext || (window as any).webkitAudioContext)();
   const gainNode = context.createGain();
   gainNode.gain.value = 4; // Increased volume (0.5 instead of default)
   
   const oscillator = context.createOscillator();
   oscillator.type = 'sine';
   oscillator.frequency.value = 400; // Increased pitch from 300 to 400
   oscillator.connect(gainNode);
   gainNode.connect(context.destination);
   
   oscillator.start();
   setTimeout(() => {
     oscillator.frequency.value = 250; // Increased pitch from 200 to 250
     setTimeout(() => {
       oscillator.stop();
       context.close();
     }, 300);
   }, 200);
 } catch (error) {
   console.error('Audio error:', error);
 }
};

  
  // Switch camera
  const switchCamera = () => {
    if (cameras.length <= 1) {
      setStatusMessage('Only one camera available');
      return;
    }
    
    const currentIndex = cameras.findIndex(cam => cam.id === currentCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setCurrentCamera(cameras[nextIndex].id);
  };
  
  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center p-0 m-0 overflow-hidden">
      {/* Status text at top */}
      <div className="w-full pt-6 pb-2 z-10 text-center">
        <p className="font-semibold text-xl text-white">{statusMessage}</p>
      </div>
      
      {/* Full screen scanner container with color flashing overlay */}
      <div className="relative flex-1 w-full">
        {/* Transparent overlay for flashing color */}
        <div 
          className="absolute inset-0 z-10 pointer-events-none transition-colors duration-300" 
          style={{ backgroundColor: scannerBackgroundColor, opacity: 0.3 }}
        />
        
        {/* Actual scanner */}
        <div 
          id="qr-scanner-container" 
          ref={containerRef}
          className="absolute inset-0 bg-black"
        />
      </div>
      
      {/* Bocttom control bar */}
      <div className="w-full py-4 px-6 flex justify-around items-center z-10 absolute bottom-0">
       
      {/* Scan button - large and centered */}
        <button
          onClick={handleScanButtonClick}
          className={`p-4 rounded-full ${isReadyToScanState || isProcessingState ? 'bg-gray-500' : 'bg-green-500'} shadow-lg`}
          disabled={isReadyToScanState || isProcessingState}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </button>        
      </div>
    </div>
  );
}