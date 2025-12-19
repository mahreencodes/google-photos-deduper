// Popup script for Chrome Extension

import {
  DiscoverPhotosMessageType,
  DiscoverPhotosProgressMessageType,
  DiscoverPhotosResultMessageType,
  SendPhotosToBackendMessageType,
  SendPhotosToBackendResultMessageType,
  PhotoMetadata,
} from "types";

// Get DOM elements
const discoverButton = document.getElementById("discover-btn") as HTMLButtonElement;
const sendButton = document.getElementById("send-btn") as HTMLButtonElement;
const analyzeButton = document.getElementById("analyze-btn") as HTMLButtonElement;
const statusDiv = document.getElementById("status") as HTMLDivElement;
const progressDiv = document.getElementById("progress") as HTMLDivElement;
const photosCountSpan = document.getElementById("photos-count") as HTMLSpanElement;

let discoveredPhotos: PhotoMetadata[] = [];
let photosSent = false;

// Initialize popup
document.addEventListener("DOMContentLoaded", () => {
  checkStatus();
  
  discoverButton.addEventListener("click", handleDiscoverClick);
  sendButton.addEventListener("click", handleSendClick);
  analyzeButton.addEventListener("click", handleAnalyzeClick);
});

async function checkStatus() {
  try {
    // Check if backend is reachable
    const response = await fetch("http://localhost:5001/auth/me");
    if (response.ok) {
      statusDiv.textContent = "✅ Connected to backend";
      statusDiv.className = "status success";
    } else {
      statusDiv.textContent = "⚠️ Not logged in. Please log in to the web app.";
      statusDiv.className = "status warning";
    }
  } catch (error) {
    statusDiv.textContent = "❌ Backend not reachable. Please start the app.";
    statusDiv.className = "status error";
  }
}

async function handleDiscoverClick() {
  discoverButton.disabled = true;
  discoverButton.textContent = "Discovering...";
  progressDiv.style.display = "block";
  progressDiv.textContent = "Starting photo discovery...";
  
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.id) {
      throw new Error("No active tab found");
    }
    
    if (!tab.url?.includes("photos.google.com")) {
      alert("Please navigate to photos.google.com first!");
      resetDiscoverButton();
      return;
    }
    
    // Listen for progress updates
    const progressListener = (message: any) => {
      if (message?.app === "GooglePhotosDeduper" && message?.action === "discoverPhotos.progress") {
        const progressMsg = message as DiscoverPhotosProgressMessageType;
        progressDiv.textContent = `Discovering photos... Found ${progressMsg.photosDiscovered} photos (Batch ${progressMsg.currentBatch})`;
      }
    };
    
    chrome.runtime.onMessage.addListener(progressListener);
    
    // Send message to content script
    const message: DiscoverPhotosMessageType = {
      app: "GooglePhotosDeduper",
      action: "discoverPhotos",
    };
    
    chrome.tabs.sendMessage(tab.id, message, (response) => {
      chrome.runtime.onMessage.removeListener(progressListener);
      
      if (chrome.runtime.lastError) {
        progressDiv.textContent = `Error: ${chrome.runtime.lastError.message}`;
        progressDiv.className = "progress error";
        resetDiscoverButton();
        return;
      }
    });
    
    // Listen for result
    const resultListener = (message: any) => {
      if (message?.app === "GooglePhotosDeduper" && message?.action === "discoverPhotos.result") {
        const resultMsg = message as DiscoverPhotosResultMessageType;
        chrome.runtime.onMessage.removeListener(resultListener);
        
        if (resultMsg.success) {
          discoveredPhotos = resultMsg.photos;
          progressDiv.textContent = `✅ Discovered ${resultMsg.totalPhotos} photos!`;
          progressDiv.className = "progress success";
          photosCountSpan.textContent = resultMsg.totalPhotos.toString();
          sendButton.disabled = false;
        } else {
          progressDiv.textContent = `❌ Error: ${resultMsg.error}`;
          progressDiv.className = "progress error";
        }
        
        resetDiscoverButton();
      }
    };
    
    chrome.runtime.onMessage.addListener(resultListener);
    
  } catch (error) {
    progressDiv.textContent = `Error: ${error}`;
    progressDiv.className = "progress error";
    resetDiscoverButton();
  }
}

async function handleSendClick() {
  if (discoveredPhotos.length === 0) {
    alert("Please discover photos first!");
    return;
  }
  
  sendButton.disabled = true;
  sendButton.textContent = "Sending...";
  progressDiv.textContent = "Sending photos to backend...";
  progressDiv.style.display = "block";
  
  try {
    // Send photos in batches to avoid overwhelming the backend
    const batchSize = 100;
    const totalBatches = Math.ceil(discoveredPhotos.length / batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, discoveredPhotos.length);
      const batch = discoveredPhotos.slice(start, end);
      const isFinal = i === totalBatches - 1;
      
      progressDiv.textContent = `Sending batch ${i + 1}/${totalBatches}...`;
      
      const response = await fetch("http://localhost:5001/api/extension/photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          photos: batch,
          batch_number: i + 1,
          total_batches: totalBatches,
          is_final: isFinal,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send batch ${i + 1}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`Batch ${i + 1} sent. Total stored: ${result.total_stored}`);
    }
    
    progressDiv.textContent = `✅ Sent all ${discoveredPhotos.length} photos to backend!`;
    progressDiv.className = "progress success";
    photosSent = true;
    analyzeButton.disabled = false;
    sendButton.textContent = "✓ Sent";
    
  } catch (error) {
    progressDiv.textContent = `❌ Error sending photos: ${error}`;
    progressDiv.className = "progress error";
    sendButton.disabled = false;
    sendButton.textContent = "Send to Backend";
  }
}

async function handleAnalyzeClick() {
  if (!photosSent) {
    alert("Please send photos to backend first!");
    return;
  }
  
  analyzeButton.disabled = true;
  analyzeButton.textContent = "Starting...";
  progressDiv.textContent = "Starting duplicate analysis...";
  progressDiv.style.display = "block";
  
  try {
    const response = await fetch("http://localhost:5001/api/extension/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        resolution: 224,
        similarity_threshold: 0.9,
        download_original: false,
        chunk_size: 1000,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || response.statusText);
    }
    
    const result = await response.json();
    progressDiv.textContent = `✅ Analysis started! Task ID: ${result.task_id}`;
    progressDiv.className = "progress success";
    
    // Open the app to show progress
    setTimeout(() => {
      chrome.tabs.create({ url: "http://localhost:3000" });
    }, 1000);
    
  } catch (error) {
    progressDiv.textContent = `❌ Error starting analysis: ${error}`;
    progressDiv.className = "progress error";
    analyzeButton.disabled = false;
    analyzeButton.textContent = "Start Analysis";
  }
}

function resetDiscoverButton() {
  discoverButton.disabled = false;
  discoverButton.textContent = "Discover Photos";
}

