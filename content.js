// Content script for Sherpa 2 (Apache)
// Handles on-page element search and highlighting

console.log('🌲 Sherpa 2 (Apache) content script loaded');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Content script received message:', request);
  
  if (request.action === 'test') {
    console.log('✅ Content script test message received');
    sendResponse({ success: true, message: 'Content script is ready' });
  } else if (request.action === 'searchOnPage') {
    const result = searchOnPage(request.searchTerm);
    sendResponse(result);
  } else if (request.action === 'scrapePage') {
    console.log('🔍 Content script starting page scrape...');
    try {
      const result = scrapePage();
      console.log('📄 Content script scrape result:', result);
      // Always send a response, even if result is undefined
      sendResponse(result || {
        success: false,
        error: 'ScrapePage returned undefined'
      });
    } catch (error) {
      console.error('🍂 Content script scrape error:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  
  // Return true to indicate we will send a response asynchronously
  return true;
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

// Scrape page for links and content
function scrapePage() {
  console.log('🔍 Scraping page for links and content...');
  
  try {
    const title = document.title || 'Untitled Page';
    const links = [];
    const headings = [];
    
    // Extract all links
    const linkElements = document.querySelectorAll('a[href]');
    linkElements.forEach(link => {
      const href = link.href;
      const text = link.textContent.trim();
      
      // Skip empty links and javascript links
      if (text && !href.startsWith('javascript:') && !href.startsWith('#')) {
        links.push({
          text: text,
          href: href,
          title: link.title || ''
        });
      }
    });
    
    // Extract headings
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headingElements.forEach(heading => {
      const text = heading.textContent.trim();
      if (text) {
        headings.push({
          level: parseInt(heading.tagName.charAt(1)),
          text: text
        });
      }
    });
    
    // Remove duplicates and sort by relevance
    const uniqueLinks = removeDuplicateLinks(links);
    const sortedLinks = sortLinksByRelevance(uniqueLinks);
    
    console.log(`📄 Scraped: "${title}" - ${sortedLinks.length} links, ${headings.length} headings`);
    
    return {
      success: true,
      title: title,
      links: sortedLinks,
      headings: headings
    };
    
  } catch (error) {
    console.error('🍂 Page scraping error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Remove duplicate links based on href
function removeDuplicateLinks(links) {
  const seen = new Set();
  return links.filter(link => {
    if (seen.has(link.href)) {
      return false;
    }
    seen.add(link.href);
    return true;
  });
}

// Sort links by relevance (shorter, more descriptive text first)
function sortLinksByRelevance(links) {
  return links.sort((a, b) => {
    // Prioritize links with meaningful text
    const aScore = calculateLinkRelevanceScore(a);
    const bScore = calculateLinkRelevanceScore(b);
    return bScore - aScore;
  });
}

// Calculate relevance score for a link
function calculateLinkRelevanceScore(link) {
  let score = 0;
  const text = link.text.toLowerCase();
  
  // Longer text is generally more descriptive
  score += Math.min(text.length, 50);
  
  // Penalize very short text (likely not descriptive)
  if (text.length < 3) score -= 20;
  
  // Bonus for common navigation terms
  const navTerms = ['home', 'about', 'contact', 'services', 'products', 'blog', 'news', 'help', 'support'];
  if (navTerms.some(term => text.includes(term))) {
    score += 10;
  }
  
  // Bonus for links that look like buttons or navigation
  if (text.match(/^(click|go|view|read|learn|get|find|search|browse)/i)) {
    score += 5;
  }
  
  // Penalize links with just URLs or numbers
  if (text.match(/^https?:\/\//) || text.match(/^\d+$/)) {
    score -= 15;
  }
  
  return score;
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