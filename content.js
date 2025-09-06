// Content script for Sherpa extension
// This runs on every webpage and can inject UI elements if needed

console.log('🏔️ Sherpa trail guide content script loaded - ready to assist on this trail');

// For now, this is minimal since the main functionality is in the popup
// In the future, this could inject floating trail markers or other UI elements

// Listen for messages from the Sherpa popup if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentUrl') {
    sendResponse({ url: window.location.href });
  }
});
