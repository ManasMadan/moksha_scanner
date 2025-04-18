/* eslint-disable react-hooks/exhaustive-deps */
// src/app/page.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import CryptoJS from 'crypto-js';

// Constants for colors and sounds
const SUCCESS_COLOR = '#22c55e'; // Green
const ERROR_COLOR = '#ef4444'; // Red
const SCANNING_COLOR = '#3b82f6'; // Blue
const DECRYPTION_KEY = 'mokshavipsecret1'; // Replace with your actual key

export default function QRScannerPage() {
  // State for UI elements
  const [statusMessage, setStatusMessage] = useState<string>('Ready to scan');
  const [statusColor, setStatusColor] = useState<string>(SCANNING_COLOR);
  const [lastResult, setLastResult] = useState<string>('');
  const [cameras, setCameras] = useState<Array<{id: string, label: string}>>([]);
  const [currentCamera, setCurrentCamera] = useState<string>('');
  const [flashOn, setFlashOn] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedCodes, setProcessedCodes] = useState<Set<string>>(new Set());
  
  // References
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize scanner when component mounts
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
    };
  }, []);
  
  // Start scanner when camera is selected
  useEffect(() => {
    if (!currentCamera || !containerRef.current) return;
    
    // Stop previous scanner if exists
    if (scannerRef.current) {
      scannerRef.current.stop()
        .then(startScanner)
        .catch(console.error);
    } else {
      startScanner();
    }
    
    function startScanner() {
      try {
        // Create scanner instance
        const scanner = new Html5Qrcode('qr-scanner-container');
        scannerRef.current = scanner;
        
        // Configure scanner with larger qrbox (increased scanning area)
        const config = {
          fps: 10,
          qrbox: { width: 300, height: 300 }, // Increased from 250x250
          aspectRatio: 1.0
        };
        
        // Start scanning
        scanner.start(
          currentCamera, 
          config,
          handleScanSuccess,
          () => {} // Silent error handling for better UX
        )
        .then(() => {
          setStatusMessage('Scanning...');
          setStatusColor(SCANNING_COLOR);
          
          // Apply flash if enabled
          if (flashOn) {
            applyFlash(true);
          }
        })
        .catch(err => {
          console.error('Scanner start error:', err);
          setStatusMessage('Failed to start scanner');
        });
      } catch (err) {
        console.error('Scanner initialization error:', err);
        setStatusMessage('Scanner initialization failed');
      }
    }
  }, [currentCamera, flashOn]);
  
  // Reset status back to scanning mode
  const resetToScanningMode = () => {
    setStatusMessage('Scanning...');
    setStatusColor(SCANNING_COLOR);
    setIsProcessing(false);
  };
  
  // Handle successful QR code scan
  const handleScanSuccess = (decodedText: string) => {
    // Avoid processing the same QR code multiple times in succession
    if (decodedText === lastResult && isProcessing) return;
    
    // Don't process new QR codes if already processing one
    if (isProcessing) return;
    
    // Check if we've already processed this code in this session
    if (processedCodes.has(decodedText)) {
      // Don't reprocess codes we've already seen
      return;
    }
    
    setLastResult(decodedText);
    processQRData(decodedText);
  };
  
  // Process the QR code data
  const processQRData = async (data: string) => {
    try {
      // Set processing flag to prevent new scans
      setIsProcessing(true);
      
      // Clear any previous reset timer
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      
      // Try to decrypt the data
      const decryptedData = decryptData(data);
      
      if (!decryptedData) {
        setStatusMessage('Decryption failed! Invalid QR code.');
        setStatusColor(ERROR_COLOR);
        errorBeep();
        
        // Set timer to reset status after 3 seconds
        resetTimerRef.current = setTimeout(resetToScanningMode, 3000);
        return;
      }
      
      // If decryption succeeded, make API request
      setStatusMessage('Processing check-in...');
      
      // Add no-cache headers to prevent caching
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
              "public_id": decryptedData,
              "action": "check-in"
            }
          ]
        }),
      });
      
      const result = await response.json();
      
      // Add this code to the set of processed codes
      setProcessedCodes(prev => new Set(prev).add(data));
      
      // Handle response
      if (result.errors && Object.keys(result.errors).length > 0) {
        // Already checked in
        const errorMessage = result.errors[decryptedData] || 'Already checked in';
        setStatusMessage(`Error: ${errorMessage}`);
        setStatusColor(ERROR_COLOR);
        errorBeep();
      } else {
        // Successful check-in
        setStatusMessage('Check-in successful!');
        setStatusColor(SUCCESS_COLOR);
        successBeep();
      }
      
      // Set timer to reset status after 3 seconds
      resetTimerRef.current = setTimeout(resetToScanningMode, 3000);
      
    } catch (error) {
      console.error('Processing error:', error);
      setStatusMessage('Error processing QR code!');
      setStatusColor(ERROR_COLOR);
      errorBeep();
      
      // Set timer to reset status after 3 seconds
      resetTimerRef.current = setTimeout(resetToScanningMode, 3000);
    }
  };
  
  // Decrypt the QR code data using AES
  const decryptData = (encryptedData: string) => {
    try {
      console.log("Attempting to decrypt:", encryptedData);
      
      // Check if the string looks like base64
      if (!/^[A-Za-z0-9+/=]+$/.test(encryptedData)) {
        console.error("Input doesn't appear to be valid Base64");
        return null;
      }
      
      const bytes = CryptoJS.AES.decrypt(encryptedData, DECRYPTION_KEY);
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
      
      console.log("Decryption result length:", decryptedData.length);
      
      if (decryptedData) {
        console.log("Successfully decrypted to:", decryptedData);
        return decryptedData;
      } else {
        console.error("Decryption produced empty result");
        return null;
      }
    } catch (error) {
      console.error('Detailed decryption error:', error);
      return null;
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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      <h1 className="text-2xl font-bold mb-6">QR Code Scanner</h1>
      
      {/* Status display */}
      <div 
        className="w-full max-w-md mb-6 p-4 rounded-lg text-center transition-colors duration-300"
        style={{ backgroundColor: statusColor }}
      >
        <p className="font-semibold">{statusMessage}</p>
        {lastResult && (
          <p className="text-sm mt-1">ID: {lastResult}</p>
        )}
      </div>
      
      {/* Scanner container - increased size */}
      <div 
        id="qr-scanner-container" 
        ref={containerRef}
        className="w-full max-w-lg aspect-square rounded-lg overflow-hidden bg-black"
      />
      
      {/* Camera controls */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={toggleFlash}
          className={`px-4 py-2 rounded-lg ${flashOn ? 'bg-yellow-500' : 'bg-gray-700'} text-white`}
          disabled={!currentCamera || isProcessing}
        >
          {flashOn ? 'Flash: ON' : 'Flash: OFF'}
        </button>
        
        <button
          onClick={switchCamera}
          className="px-4 py-2 rounded-lg bg-gray-700 text-white"
          disabled={cameras.length <= 1 || isProcessing}
        >
          Switch Camera
        </button>
        
        <button
          onClick={resetProcessedCodes}
          className="px-4 py-2 rounded-lg bg-gray-700 text-white"
        >
          Reset
        </button>
      </div>
      
      <p className="mt-6 text-sm text-gray-400">
        {isProcessing ? 'Processing... Please wait' : 'Point camera at QR code to scan'}
      </p>
    </div>
  );
}