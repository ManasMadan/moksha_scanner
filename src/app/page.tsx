// src/app/page.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import CryptoJS from 'crypto-js';

// Constants for colors and sounds
const SUCCESS_COLOR = '#22c55e'; // Green
const ERROR_COLOR = '#ef4444'; // Red
const SCANNING_COLOR = '#3b82f6'; // Blue
const DECRYPTION_KEY = 'mokshavipsecret1'; // For reference only, not used now

export default function QRScannerPage() {
  // State for UI elements
  const [statusMessage, setStatusMessage] = useState<string>('Press Scan to capture QR code');
  const [statusColor, setStatusColor] = useState<string>(SCANNING_COLOR);
  const [lastResult, setLastResult] = useState<string>('');
  const [cameras, setCameras] = useState<Array<{id: string, label: string}>>([]);
  const [currentCamera, setCurrentCamera] = useState<string>('');
  const [flashOn, setFlashOn] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isReadyToScan, setIsReadyToScan] = useState<boolean>(false);
  const [processedCodes, setProcessedCodes] = useState<Set<string>>(new Set());
  const [scannerBackgroundColor, setScannerBackgroundColor] = useState<string>('transparent');
  
  // References
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const colorFlashTimerRef = useRef<NodeJS.Timeout | null>(null);
  const qrCodeRef = useRef<string | null>(null);
  
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
        
        // Configure scanner to use almost full screen
        const config = {
          fps: 10,
          qrbox: { width: 350, height: 350 },
          aspectRatio: window.innerWidth / window.innerHeight
        };
        
        // Start scanner but don't process codes yet
        scanner.start(
          currentCamera, 
          config,
          (decodedText) => {
            // Store the QR code but don't process it yet
            qrCodeRef.current = decodedText;
            
            // Only process if ready to scan
            if (isReadyToScan && !isProcessing) {
              setIsReadyToScan(false); // Reset scan flag
              processQRData(decodedText);
            }
          },
          () => {} // Silent error handling for better UX
        )
        .then(() => {
          setStatusMessage('Press Scan to capture QR code');
          setStatusColor(SCANNING_COLOR);
          
          // Apply flash if enabled
          if (flashOn) {
            applyFlash(true);
          }
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
  }, [currentCamera, flashOn]);
  
  // Handle scan button click - set ready to scan flag
  const handleScanButtonClick = () => {
    if (isProcessing) return;
    
    setIsReadyToScan(true);
    setStatusMessage('Capturing...');
    
    // If we already have a QR code in view, process it immediately
    if (qrCodeRef.current) {
      processQRData(qrCodeRef.current);
      setIsReadyToScan(false);
    } else {
      // Set a timeout to reset if no QR code is found
      setTimeout(() => {
        if (isReadyToScan) {
          setIsReadyToScan(false);
          setStatusMessage('No QR code found. Try again.');
        }
      }, 2000);
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
    }, 2000);
  };
  
  // Process the QR code data - sending the payload directly
  const processQRData = async (data: string) => {
    try {
      // Set processing flag to prevent new scans
      setIsProcessing(true);
      setLastResult(data);
      
      // Clear any previous reset timer
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      
      // Set scanning message
      setStatusMessage('Processing check-in...');
      
      // Make API request with the direct QR payload
      const response = await fetch("https://pi.local:8123/api/public/check-in-lists/cil_9sB1sQ5J8ykpb/check-ins", {
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
      
      // Check specifically for successful check-in with data array
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        // Successful check-in
        setStatusMessage('Check-in successful!');
        setStatusColor(SUCCESS_COLOR);
        flashBackground(SUCCESS_COLOR);
        successBeep();
        
        // Add this code to the set of processed codes
        setProcessedCodes(prev => new Set(prev).add(data));
      } 
      // Check for "Invalid attendee code detected" message
      else if (result.message && result.message.includes("Invalid attendee code")) {
        setStatusMessage('Invalid attendee code!');
        setStatusColor(ERROR_COLOR);
        flashBackground(ERROR_COLOR);
        errorBeep();
      }
      // Check for other errors
      else if (result.errors && Object.keys(result.errors).length > 0) {
        // Already checked in or other errors
        const errorKey = Object.keys(result.errors)[0];
        const errorMessage = result.errors[errorKey] || 'Already checked in';
        setStatusMessage(`Error: ${errorMessage}`);
        setStatusColor(ERROR_COLOR);
        flashBackground(ERROR_COLOR);
        errorBeep();
      } 
      // Generic error handling
      else {
        setStatusMessage('Error processing check-in!');
        setStatusColor(ERROR_COLOR);
        flashBackground(ERROR_COLOR);
        errorBeep();
      }
      
      // Set timer to reset status after 3 seconds
      resetTimerRef.current = setTimeout(() => {
        setStatusMessage('Press Scan to capture QR code');
        setStatusColor(SCANNING_COLOR);
        setIsProcessing(false);
      }, 3000);
      
    } catch (error) {
      console.error('Processing error:', error);
      setStatusMessage('Error processing QR code!');
      setStatusColor(ERROR_COLOR);
      flashBackground(ERROR_COLOR);
      errorBeep();
      
      // Set timer to reset status after 3 seconds
      resetTimerRef.current = setTimeout(() => {
        setStatusMessage('Press Scan to capture QR code');
        setStatusColor(SCANNING_COLOR);
        setIsProcessing(false);
      }, 3000);
    }
  };
  
  // Play success beep
  const successBeep = () => {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = 1000;
      oscillator.connect(context.destination);
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
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = 300;
      oscillator.connect(context.destination);
      oscillator.start();
      setTimeout(() => {
        oscillator.frequency.value = 200;
        setTimeout(() => {
          oscillator.stop();
          context.close();
        }, 300);
      }, 200);
    } catch (error) {
      console.error('Audio error:', error);
    }
  };
  
  // Toggle flash
  const toggleFlash = () => {
    const newState = !flashOn;
    setFlashOn(newState);
    applyFlash(newState);
  };
  
  // Apply flash setting to scanner
  const applyFlash = (state: boolean) => {
    if (scannerRef.current) {
      try {
        scannerRef.current.applyVideoConstraints({
          advanced: [{ torch: state }]
        }).catch(err => {
          console.error('Flash error:', err);
          setStatusMessage('Flash not supported');
          setFlashOn(false);
        });
      } catch (error) {
        console.error('Flash application error:', error);
      }
    }
  };
  
  // Reset processed codes to allow rescanning
  const resetProcessedCodes = () => {
    setProcessedCodes(new Set());
    setStatusMessage('Scanner reset. Ready to scan.');
    setStatusColor(SCANNING_COLOR);
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
        {lastResult && (
          <p className="text-sm text-white">ID: {lastResult}</p>
        )}
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
      
      {/* Bottom control bar */}
      <div className="w-full py-4 px-6 flex justify-around items-center z-10 absolute bottom-0">
        {/* Flash toggle icon */}
        <button
          onClick={toggleFlash}
          className={`p-3 rounded-full ${flashOn ? 'bg-yellow-500' : 'bg-gray-800'}`}
          disabled={isProcessing}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
        
        {/* Scan button - large and centered */}
        <button
          onClick={handleScanButtonClick}
          className={`p-4 rounded-full ${isReadyToScan || isProcessing ? 'bg-gray-500' : 'bg-green-500'} shadow-lg`}
          disabled={isReadyToScan || isProcessing}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </button>
        
        {/* Controls combined: Reset + Switch Camera */}
        <div className="flex flex-col gap-4">
          {/* Switch camera icon */}
          <button
            onClick={switchCamera}
            className="p-3 rounded-full bg-gray-800"
            disabled={cameras.length <= 1 || isProcessing}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4v16M16 4v16M9 4v16" />
            </svg>
          </button>
          
          {/* Reset icon */}
          <button
            onClick={resetProcessedCodes}
            className="p-3 rounded-full bg-gray-800"
            disabled={isProcessing}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}