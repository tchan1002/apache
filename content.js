// Content script for Sherpa extension
// This runs on every webpage and can inject UI elements if needed

console.log('Sherpa content script loaded');

// For now, this is minimal since the main functionality is in the popup
// In the future, this could inject floating buttons or other UI elements

// Listen for messages from popup if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentUrl') {
    sendResponse({ url: window.location.href });
  }
});
