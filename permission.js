/**
 * permission.js for Sherpa 2 (Apache)
 * Requests user permission for microphone access
 */

/**
 * Requests user permission for microphone access and tests it.
 * @returns {Promise<void>} A Promise that resolves when permission is granted or rejects with an error.
 */
async function getUserPermission() {
  return new Promise((resolve, reject) => {
    // Using navigator.mediaDevices.getUserMedia to request microphone access
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Permission granted, test the stream
        console.log("Microphone access granted, testing stream...");

        // Test that we can actually access the audio
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);

        // Check if we can read audio data
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Stop the tracks to prevent the recording indicator from being shown
        stream.getTracks().forEach(function (track) {
          track.stop();
        });

        // Clean up audio context
        audioContext.close();

        // Notify extension that permission was granted
        if (chrome && chrome.runtime) {
          chrome.runtime.sendMessage({ type: 'MICROPHONE_PERMISSION_GRANTED' });
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'MICROPHONE_PERMISSION_GRANTED' }, '*');
        }

        resolve();
      })
      .catch((error) => {
        console.error("Error requesting microphone permission", error);

        // Notify extension that permission was denied
        if (chrome && chrome.runtime) {
          chrome.runtime.sendMessage({ 
            type: 'MICROPHONE_PERMISSION_DENIED', 
            error: error.name 
          });
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage({ 
            type: 'MICROPHONE_PERMISSION_DENIED', 
            error: error.name 
          }, '*');
        }

        reject(error);
      });
  });
}

// Update status message
function updateStatus(message, type) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }
}

// Add debugging to see what's happening
console.log("Permission page loaded, requesting microphone access...");
updateStatus("Requesting microphone permission...", "loading");

// Call the function to request microphone permission when page loads
getUserPermission()
  .then(() => {
    updateStatus("Microphone access granted! Click anywhere to close.", "success");
    // Don't auto-close - let user click to close
  })
  .catch(error => {
    console.log("Microphone permission request completed with result:", error.name);
    console.log("Error details:", error);
    
    if (error.name === 'NotAllowedError') {
      updateStatus("Microphone access denied. Click anywhere to close.", "error");
    } else {
      updateStatus(`Error: ${error.message}. Click anywhere to close.`, "error");
    }
  });

// Add click-to-close functionality
document.addEventListener('click', function() {
  if (chrome && chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'CLOSE_IFRAME' });
  } else if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'CLOSE_IFRAME' }, '*');
  }
});