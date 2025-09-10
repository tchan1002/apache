// Background service worker for Sherpa 2 (Apache)
// Handles extension lifecycle and message routing

console.log('🌲 Sherpa 2 (Apache) background service loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🌲 Sherpa 2 (Apache) extension installed - your voice assistant is ready!');
  } else if (details.reason === 'update') {
    console.log('🌲 Sherpa 2 (Apache) extension updated');
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background received message:', request);
  
  // Handle microphone permission messages
  if (request.type === 'MICROPHONE_PERMISSION_GRANTED' || 
      request.type === 'MICROPHONE_PERMISSION_DENIED' || 
      request.type === 'CLOSE_IFRAME') {
    
    console.log('🎤 Background received permission message:', request.type);
    
    // Forward the message to the popup
    chrome.runtime.sendMessage(request);
    
    // Close the permission tab if it's a close request
    if (request.type === 'CLOSE_IFRAME' && sender.tab) {
      chrome.tabs.remove(sender.tab.id);
    }
  }
  
  // Handle tab queries
  if (request.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] });
    });
    return true; // Keep message channel open for async response
  }
  
  // Handle navigation requests
  if (request.action === 'navigate') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.update(tabs[0].id, { url: request.url });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    return true;
  }
});

// Handle tab updates for context awareness
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('🌐 Tab updated:', tab.url);
    // Could add context awareness here in the future
  }
});

// Handle tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab) {
      console.log('🌐 Tab activated:', tab.url);
    }
  });
});