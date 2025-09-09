// Background service worker for Sherpa extension

console.log('🌲 Sherpa trail guide background service loaded - ready to assist your journey');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🌲 Sherpa trail guide extension installed - your digital mountaineering companion is ready!');
  }
});

// Handle messages from trail content scripts or Sherpa popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] });
    });
    return true; // Keep message channel open for async response
  }
  
  // Handle microphone permission messages from permission page
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
});
