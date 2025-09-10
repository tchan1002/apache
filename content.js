// Content script for Sherpa 2 (Apache)
// Handles on-page element search and highlighting

console.log('🌲 Sherpa 2 (Apache) content script loaded');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchOnPage') {
    const result = searchOnPage(request.searchTerm);
    sendResponse(result);
  }
});

// Search for elements on the current page
function searchOnPage(searchTerm) {
  console.log('🔍 Searching page for:', searchTerm);
  
  // Clear any previous highlights
  clearHighlights();
  
  // Search for text content
  const textResults = searchTextContent(searchTerm);
  
  // Search for form elements (buttons, inputs, etc.)
  const elementResults = searchFormElements(searchTerm);
  
  // Search for images with alt text
  const imageResults = searchImages(searchTerm);
  
  // Combine all results
  const allResults = [...textResults, ...elementResults, ...imageResults];
  
  if (allResults.length > 0) {
    // Highlight the first few results
    highlightResults(allResults.slice(0, 3));
    
    // Scroll to first result
    if (allResults[0].element) {
      allResults[0].element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
    
    return {
      found: true,
      message: `Found ${allResults.length} matches. Highlighted the first ${Math.min(3, allResults.length)}.`,
      results: allResults
    };
  } else {
    return {
      found: false,
      message: `No matches found for "${searchTerm}"`,
      results: []
    };
  }
}

// Search for text content on the page
function searchTextContent(searchTerm) {
  const results = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script and style elements
        if (node.parentElement.tagName === 'SCRIPT' || 
            node.parentElement.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Check if text contains search term
        if (node.textContent.toLowerCase().includes(searchTerm.toLowerCase())) {
          return NodeFilter.FILTER_ACCEPT;
        }
        
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    // Find the parent element to highlight
    let element = node.parentElement;
    
    // Skip if already found
    if (results.some(r => r.element === element)) {
      continue;
    }
    
    // Skip if element is too small (likely not meaningful)
    if (element.textContent.trim().length < searchTerm.length) {
      continue;
    }
    
    results.push({
      type: 'text',
      element: element,
      text: element.textContent.trim().substring(0, 100) + '...',
      searchTerm: searchTerm
    });
  }
  
  return results;
}

// Search for form elements
function searchFormElements(searchTerm) {
  const results = [];
  const searchLower = searchTerm.toLowerCase();
  
  // Search buttons
  const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
  buttons.forEach(button => {
    const text = (button.textContent || button.value || button.alt || '').toLowerCase();
    if (text.includes(searchLower)) {
      results.push({
        type: 'button',
        element: button,
        text: button.textContent || button.value || button.alt,
        searchTerm: searchTerm
      });
    }
  });
  
  // Search inputs
  const inputs = document.querySelectorAll('input[type="text"], input[type="search"], textarea');
  inputs.forEach(input => {
    const text = (input.placeholder || input.value || input.name || '').toLowerCase();
    if (text.includes(searchLower)) {
      results.push({
        type: 'input',
        element: input,
        text: input.placeholder || input.value || input.name,
        searchTerm: searchTerm
      });
    }
  });
  
  // Search links
  const links = document.querySelectorAll('a');
  links.forEach(link => {
    const text = (link.textContent || link.title || '').toLowerCase();
    if (text.includes(searchLower)) {
      results.push({
        type: 'link',
        element: link,
        text: link.textContent || link.title,
        searchTerm: searchTerm
      });
    }
  });
  
  return results;
}

// Search for images with alt text
function searchImages(searchTerm) {
  const results = [];
  const searchLower = searchTerm.toLowerCase();
  
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    const altText = (img.alt || img.title || '').toLowerCase();
    if (altText.includes(searchLower)) {
      results.push({
        type: 'image',
        element: img,
        text: img.alt || img.title,
        searchTerm: searchTerm
      });
    }
  });
  
  return results;
}

// Highlight search results
function highlightResults(results) {
  results.forEach((result, index) => {
    if (result.element) {
      // Add highlight class
      result.element.classList.add('sherpa-highlight');
      
      // Add a unique ID for this highlight
      result.element.setAttribute('data-sherpa-highlight', index);
      
      // Add a subtle animation
      result.element.style.transition = 'all 0.3s ease';
      result.element.style.transform = 'scale(1.02)';
      
      // Remove highlight after 5 seconds
      setTimeout(() => {
        if (result.element) {
          result.element.classList.remove('sherpa-highlight');
          result.element.style.transform = '';
        }
      }, 5000);
    }
  });
}

// Clear all highlights
function clearHighlights() {
  const highlighted = document.querySelectorAll('.sherpa-highlight');
  highlighted.forEach(element => {
    element.classList.remove('sherpa-highlight');
    element.style.transform = '';
    element.removeAttribute('data-sherpa-highlight');
  });
}

// Add CSS for highlighting
const style = document.createElement('style');
style.textContent = `
  .sherpa-highlight {
    background-color: #fef3c7 !important;
    border: 2px solid #f59e0b !important;
    border-radius: 4px !important;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2) !important;
  }
`;
document.head.appendChild(style);