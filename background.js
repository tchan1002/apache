// Background service worker for Sherpa extension

console.log('🏔️ Sherpa trail guide background service loaded - ready to assist your journey');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🏔️ Sherpa trail guide extension installed - your digital mountaineering companion is ready!');
  }
});

// Handle messages from trail content scripts or guide popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] });
    });
    return true; // Keep message channel open for async response
  }
});
