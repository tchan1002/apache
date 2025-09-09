// API Configuration
const PATHFINDER_API_BASE = 'https://pathfinder-bay-mu.vercel.app/api';

// State
let currentQuestion = '';
let currentAnswer = null;
let currentSource = null;
let currentSiteId = null;
let currentUrl = null;
let currentDomain = null;
let isScouted = false;
let isScouting = false; // Track if scouting is in progress
let mountaineeringUpdateInterval = null;

// Voice recognition state
let recognition = null;
let isListening = false;
let isVoiceSupported = false;
let microphonePermissionGranted = false;
// Removed permissionIframe - using direct permission requests

// Performance tracking
const performanceMetrics = {
  pageCheckTimes: [],
  domainCheckTimes: []
};

// Smart timeout system
const TIMEOUT_MS = 2000; // Increased to 2 seconds for better reliability

// Log performance optimization
let logBuffer = [];
let logDisplayLimit = 50; // Show only last 50 lines
let logUpdateInterval = null;

// Adjust log display limit for performance
function setLogDisplayLimit(limit) {
  logDisplayLimit = Math.max(10, Math.min(200, limit)); // Between 10-200 lines
  addDebugLog(`📊 Log display limit set to ${logDisplayLimit} lines`);
  updateLogDisplay(); // Immediately update display
}

// Reduce log verbosity during high-activity periods
function reduceLogVerbosity() {
  logDisplayLimit = 25; // Show fewer lines during heavy activity
  addDebugLog('📊 Reduced log verbosity for better performance');
}

// Restore normal log verbosity
function restoreLogVerbosity() {
  logDisplayLimit = 50; // Back to normal
  addDebugLog('📊 Restored normal log verbosity');
}

// DOM Elements
const questionSectionEl = document.getElementById('question-section');
const questionInputEl = document.getElementById('question-input');
const analyzeBtnEl = document.getElementById('analyze-btn');
const queryBtnEl = document.getElementById('query-btn');
const voiceBtnEl = document.getElementById('voice-btn');
const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('status-text');
const resultEl = document.getElementById('result');
const answerTextEl = document.getElementById('answer-text');
const sourceUrlEl = document.getElementById('source-url');
const sourceTitleEl = document.getElementById('source-title');
const goToSourceBtnEl = document.getElementById('go-to-source-btn');
const feedbackBtnEl = document.getElementById('feedback-btn');
const feedbackEl = document.getElementById('feedback');
const yesBtnEl = document.getElementById('yes-btn');
const noBtnEl = document.getElementById('no-btn');
const errorEl = document.getElementById('error');
const errorTextEl = document.getElementById('error-text');
const debugEl = document.getElementById('debug');
const debugHeaderEl = document.getElementById('debug-header');
const debugContentEl = document.getElementById('debug-content');
const copyLogBtnEl = document.getElementById('copy-log-btn');
const clearLogBtnEl = document.getElementById('clear-log-btn');
const testMicBtnEl = document.getElementById('test-mic-btn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  analyzeBtnEl.addEventListener('click', handleAnalyze);
  queryBtnEl.addEventListener('click', handleQuery);
  voiceBtnEl.addEventListener('click', handleVoiceInput);
  copyLogBtnEl.addEventListener('click', copyDebugLog);
  clearLogBtnEl.addEventListener('click', clearDebugLog);
  testMicBtnEl.addEventListener('click', testMicrophonePermission);
  debugHeaderEl.addEventListener('click', toggleDebugLog);
  
  // Add Enter key support
  questionInputEl.addEventListener('keypress', handleEnterKey);
  
  // Add click support for source URL
  sourceUrlEl.addEventListener('click', handleSourceClick);
  
  // Initialize voice recognition
  initializeVoiceRecognition();
  
  // Load persistent state
  await loadPersistentState();
  
  // Show loading message while checking website status
  showStatus('Checking if we\'ve been here before', 'working');
  
  // Check if current website is already scouted
  await checkWebsiteStatus();
  
  // Set up tab change listener for persistent window
  setupTabChangeListener();
  
  addDebugLog('🌿 Sherpa guide ready - ready to scout trails');
});

// Load persistent state from storage (for reference only - real-time check will override)
async function loadPersistentState() {
  try {
    const result = await chrome.storage.local.get(['sherpaState']);
    if (result.sherpaState) {
      const state = result.sherpaState;
      addDebugLog(`🌿 Found cached state for: ${state.url} (will verify with real-time check)`);
    } else {
      addDebugLog(`🌿 No cached state found, will perform real-time check`);
    }
  } catch (error) {
    addDebugLog(`🍂 Failed to load persistent state: ${error.message}`);
  }
}

// Save persistent state to storage
async function savePersistentState() {
  try {
    const state = {
      siteId: currentSiteId,
      url: currentUrl,
      domain: currentDomain,
      isScouted: isScouted,
      timestamp: Date.now()
    };
    await chrome.storage.local.set({ sherpaState: state });
    addDebugLog(`🌿 Saved state for website: ${currentUrl}`);
  } catch (error) {
    addDebugLog(`🍂 Failed to save persistent state: ${error.message}`);
  }
}

// Clear persistent state
async function clearPersistentState() {
  try {
    await chrome.storage.local.remove(['sherpaState']);
    addDebugLog('🌿 Cleared persistent state');
  } catch (error) {
    addDebugLog(`🍂 Failed to clear persistent state: ${error.message}`);
  }
}

// Check if current website is already scouted (CACHE-ONLY VERSION)
async function checkWebsiteStatus() {
  try {
    // Get current tab URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabUrl = tab.url;
    
    if (!tabUrl || tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://')) {
      showError('Sherpa can only scout regular websites');
      return;
    }

    currentUrl = tabUrl;
    currentDomain = extractDomain(tabUrl);
    
    addDebugLog(`Checking cached state for: ${currentUrl}`);
    
    // Show loading status with cycling mountaineering messages
    showStatus('Checking if we\'ve been here before...', 'working');
    startMountaineeringCheckUpdates();
    
    // Load cached state
    const result = await chrome.storage.local.get(['sherpaState']);
    
    if (result.sherpaState && 
        result.sherpaState.url === currentUrl && 
        result.sherpaState.isScouted) {
      
      addDebugLog(`Found cached state for: ${currentUrl} - showing query interface`);
      currentSiteId = result.sherpaState.siteId;
      isScouted = true;
      stopMountaineeringUpdates(); // Stop the cycling check messages
      hideStatus();
      showQueryButton();
      return;
    }
    
    // No cached state or different URL - show scout button
    addDebugLog(`No cached state found for: ${currentUrl} - showing scout button`);
    stopMountaineeringUpdates(); // Stop the cycling check messages
    hideStatus();
    showScoutButton();
    
  } catch (error) {
    addDebugLog(`Website check failed: ${error.message}`);
    stopMountaineeringUpdates(); // Stop the cycling check messages
    showError('Failed to check website status');
    hideStatus();
    showScoutButton();
  }
}

// Helper function: Direct page check
async function checkPageDirect(url) {
  const response = await fetch('https://pathfinder-bay-mu.vercel.app/api/sherpa/v1/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      url: url,
      checkVectorIndex: true,
      checkSpecificPath: true
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return await response.json();
}

// Helper function: Domain-only check
async function checkDomainOnly(domain) {
  const response = await fetch('https://pathfinder-bay-mu.vercel.app/api/sherpa/v1/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      url: `https://${domain}`,
      checkVectorIndex: true,
      checkSpecificPath: false
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return await response.json();
}

// Helper function: Log performance metrics
function logPerformanceMetrics() {
  if (performanceMetrics.pageCheckTimes.length > 0) {
    const avgPageTime = performanceMetrics.pageCheckTimes.reduce((a, b) => a + b, 0) / performanceMetrics.pageCheckTimes.length;
    addDebugLog(`Average page check time: ${avgPageTime.toFixed(0)}ms`);
  }
  if (performanceMetrics.domainCheckTimes.length > 0) {
    const avgDomainTime = performanceMetrics.domainCheckTimes.reduce((a, b) => a + b, 0) / performanceMetrics.domainCheckTimes.length;
    addDebugLog(`Average domain check time: ${avgDomainTime.toFixed(0)}ms`);
  }
}

// Clear website state when it's no longer scouted
async function clearWebsiteState() {
  addDebugLog('🌿 Clearing website state - website no longer scouted');
  
  // Reset all state variables
  currentSiteId = null;
  isScouted = false;
  currentAnswer = null;
  currentSource = null;
  
  // Clear persistent state
  await clearPersistentState();
}

// Mountaineering options for "Checking if we've been here before"
const mountaineeringCheckMessages = [
  'Checking if we\'ve been here before...',
  'Consulting the trail register...',
  'Looking for familiar landmarks...',
  'Checking our route history...',
  'Scanning for previous waypoints...',
  'Reviewing the expedition log...',
  'Checking the summit register...',
  'Looking for our trail markers...',
  'Consulting the climbing journal...',
  'Checking for previous ascents...',
  'Reviewing the route beta...',
  'Looking for familiar terrain...',
  'Checking the guidebook notes...',
  'Scanning for known paths...',
  'Consulting the mountain lore...',
  'Checking our climbing history...',
  'Looking for previous campsites...',
  'Reviewing the approach notes...',
  'Checking the descent route...',
  'Consulting the peak register...'
];

// Start mountaineering status updates during exploration
function startMountaineeringUpdates() {
  const mountaineeringMessages = [
    'Turning the corner...',
    'Climbing up the path...',
    'Navigating through the undergrowth...',
    'Checking the trail markers...',
    'Ascending the ridge...',
    'Crossing the stream...',
    'Following the winding trail...',
    'Reaching the next waypoint...',
    'Scouting ahead...',
    'Making steady progress...',
    'Finding the best route...',
    'Pushing through the thicket...',
    'Gaining elevation...',
    'Spotting landmarks...',
    'Adjusting the compass...',
    'Taking in the view...',
    'Plotting the next course...',
    'Moving through the forest...',
    'Checking the map...',
    'Pressing onward...'
  ];
  
  let messageIndex = 0;
  
  mountaineeringUpdateInterval = setInterval(() => {
    if (messageIndex < mountaineeringMessages.length) {
      const message = mountaineeringMessages[messageIndex];
      showStatus(message, 'working');
      addDebugLog(`🏔️ Mountaineering update: ${message}`);
      messageIndex++;
    } else {
      // Cycle through messages again
      messageIndex = 0;
    }
  }, 3000); // Update every 3 seconds
}

// Stop mountaineering status updates
function stopMountaineeringUpdates() {
  if (mountaineeringUpdateInterval) {
    clearInterval(mountaineeringUpdateInterval);
    mountaineeringUpdateInterval = null;
    addDebugLog('🏔️ Stopped mountaineering updates');
  }
}

// Start mountaineering check status updates
function startMountaineeringCheckUpdates() {
  let messageIndex = 0;
  
  mountaineeringUpdateInterval = setInterval(() => {
    if (messageIndex < mountaineeringCheckMessages.length) {
      const message = mountaineeringCheckMessages[messageIndex];
      showStatus(message, 'working');
      addDebugLog(`🏔️ Check update: ${message}`);
      messageIndex++;
    } else {
      // Cycle through messages again
      messageIndex = 0;
    }
  }, 2000); // Update every 2 seconds for check messages
}

// Handle Enter key press
function handleEnterKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault(); // Prevent form submission
    
    // Don't allow Enter key during scouting (but allow during check phase)
    if (isScouting) {
      addDebugLog('⌨️ Enter key pressed but ignored - currently scouting');
      return;
    }
    
    // Check which action should be active based on current state
    if (!analyzeBtnEl.classList.contains('hidden') && !analyzeBtnEl.disabled) {
      // Scout button is visible and enabled - trigger scouting
      addDebugLog('⌨️ Enter key pressed - triggering scout trail');
      handleAnalyze();
    } else if (isScouted && !queryBtnEl.classList.contains('hidden') && !queryBtnEl.disabled) {
      // Query button is visible and enabled - trigger query
      addDebugLog('⌨️ Enter key pressed - triggering ask question');
      handleQuery();
    }
  }
}

// Handle source URL click
function handleSourceClick(event) {
  event.preventDefault(); // Prevent default anchor behavior
  const url = sourceUrlEl.href;
  if (url && url !== '#') {
    addDebugLog(`🌿 Opening source URL: ${url}`);
    chrome.tabs.create({ url: url });
  }
}

// Hide scout button and show query section with smooth animation
function hideScoutButton() {
  addDebugLog('🌿 Hiding scout button with animation');
  
  // Animate out scout button
  analyzeBtnEl.classList.add('hidden');
  
  // Wait for animation to complete, then show query section
  setTimeout(() => {
    showQueryButton();
  }, 300);
}

// Show scout button with smooth animation
async function showScoutButton() {
  addDebugLog('🌿 Showing scout button with animation');
  
  // Reset state
  currentSiteId = null;
  isScouted = false;
  isScouting = false; // Reset scouting state
  currentAnswer = null;
  currentSource = null;
  
  // Hide ALL other elements first
  queryBtnEl.classList.add('hidden');
  questionInputEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  
  // Update voice button visibility (will hide it since no entry field)
  updateVoiceButtonVisibility();
  
  // Hide loading message and show scout button
  hideStatus();
  
  // Re-enable and show the scout button
  analyzeBtnEl.disabled = false;
  analyzeBtnEl.classList.remove('hidden');
  
  // Debug: Check if button is visible
  addDebugLog(`🌿 Scout button classes: ${analyzeBtnEl.className}`);
  addDebugLog(`🌿 Question section classes: ${questionSectionEl.className}`);
  addDebugLog(`🌿 Scout button display: ${window.getComputedStyle(analyzeBtnEl).display}`);
}

// Show query button and input with smooth animation
function showQueryButton() {
  // Don't show query interface if scouting is in progress
  if (isScouting) {
    addDebugLog('🌿 Not showing query interface - scouting in progress');
    return;
  }
  
  addDebugLog('🌿 Showing query section with animation');
  
  // Show query interface
  queryBtnEl.classList.remove('hidden');
  questionInputEl.classList.remove('hidden');
  questionSectionEl.classList.remove('hidden');
  
  // Update voice button visibility based on simple rule
  updateVoiceButtonVisibility();
  
  // Request microphone permission if needed
  if (isVoiceSupported && !microphonePermissionGranted) {
    requestMicrophonePermission();
  }
}

// Show status with smooth animation
function showStatus(message, type) {
  statusTextEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden', 'fade-out');
  
  // Add loading animation for working status
  if (type === 'working') {
    statusTextEl.classList.add('loading-dots');
  } else {
    statusTextEl.classList.remove('loading-dots');
  }
  
  addDebugLog(`🌿 Trail status: ${message}`);
}

// Hide status with smooth fade-out animation
function hideStatus() {
  statusEl.classList.add('fade-out');
  setTimeout(() => {
    statusEl.classList.add('hidden');
    statusEl.classList.remove('fade-out');
  }, 300); // Match CSS transition duration
}


// Toggle debug log visibility
function toggleDebugLog() {
  debugContentEl.classList.toggle('hidden');
  addDebugLog('🌿 Trail log toggled');
}

// Set up tab change listener for persistent window
function setupTabChangeListener() {
  // Listen for tab updates (navigation, URL changes)
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only respond to completed navigation on the active tab
    if (changeInfo.status === 'complete' && tab.active) {
      addDebugLog(`🌿 Tab navigation detected: ${tab.url}`);
      
      // Add smooth transition effect
      showStatus('Updating trail view...', 'working');
      
      // Small delay for smooth transition
      setTimeout(async () => {
        // Update current URL and domain
        currentUrl = tab.url;
        currentDomain = extractDomain(tab.url);
        
        // Check if the new page is scouted
        await checkWebsiteStatus();
        
        // Hide the updating status
        hideStatus();
      }, 300);
    }
  });
  
  // Listen for tab activation (switching between tabs)
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      addDebugLog(`🌿 Tab switched to: ${tab.url}`);
      
      // Add smooth transition effect
      showStatus('Switching trail view...', 'working');
      
      // Small delay for smooth transition
      setTimeout(async () => {
        // Update current URL and domain
        currentUrl = tab.url;
        currentDomain = extractDomain(tab.url);
        
        // Check if the new page is scouted
        await checkWebsiteStatus();
        
        // Hide the updating status
        hideStatus();
      }, 300);
    } catch (error) {
      addDebugLog(`🍂 Error handling tab switch: ${error.message}`);
    }
  });
}

// Show result with smooth animation
function showResult(answer, sources) {
  addDebugLog('🌿 Showing result with animation');
  addDebugLog(`🌿 Sources received: ${sources ? sources.length : 0} sources`);
  if (sources && sources.length > 0) {
    addDebugLog(`🌿 First source: ${JSON.stringify(sources[0])}`);
  }
  
  // Hide status first
  hideStatus();
  
  // Show result
  setTimeout(() => {
    resultEl.classList.remove('hidden');
    addDebugLog('🌿 Result section shown');
    
    // Check source section visibility
    const sourceSection = resultEl.querySelector('.source-section');
    if (sourceSection) {
      addDebugLog(`🌿 Source section display: "${window.getComputedStyle(sourceSection).display}"`);
      addDebugLog(`🌿 Source section visibility: "${window.getComputedStyle(sourceSection).visibility}"`);
    } else {
      addDebugLog('🌿 Source section not found!');
    }
    
    // Check if answer is "I don't know" or similar - hide answer section, show only trail marker
    if (answer.toLowerCase().includes("i don't know") || 
        answer.toLowerCase().includes("i do not know") ||
        answer.toLowerCase().includes("i'm not sure") ||
        answer.toLowerCase().includes("i am not sure") ||
        answer.toLowerCase().includes("unable to find") ||
        answer.toLowerCase().includes("no information found")) {
      
      // Hide the answer section but show the trail marker
      const answerSection = resultEl.querySelector('.answer-section');
      if (answerSection) {
        answerSection.style.display = 'none'; // Comment out instead of remove
      }
      
      // Show trail marker with helpful message
      if (sources.length > 0) {
        const source = sources[0];
        addDebugLog(`🌿 Setting trail marker URL (no answer): ${source.url}`);
        
        try {
          if (!sourceTitleEl) {
            addDebugLog('🍂 sourceTitleEl not found!');
            return;
          }
          if (!sourceUrlEl) {
            addDebugLog('🍂 sourceUrlEl not found!');
            return;
          }
          
          sourceTitleEl.textContent = 'Trail Marker:';
          sourceUrlEl.textContent = source.url;
          sourceUrlEl.href = source.url; // Make it a proper link
          
          addDebugLog(`🌿 Source URL element text: "${sourceUrlEl.textContent}"`);
          addDebugLog(`🌿 Source URL element href: "${sourceUrlEl.href}"`);
          addDebugLog(`🌿 Source URL element display: "${window.getComputedStyle(sourceUrlEl).display}"`);
          addDebugLog(`🌿 Source URL element visibility: "${window.getComputedStyle(sourceUrlEl).visibility}"`);
          
          if (goToSourceBtnEl) {
            goToSourceBtnEl.onclick = () => {
              chrome.tabs.create({ url: source.url });
            };
          }
        } catch (error) {
          addDebugLog(`🍂 Error setting trail marker: ${error.message}`);
        }
      } else {
        addDebugLog('🌿 No sources available for trail marker (no answer)');
      }
    } else {
      // Normal answer - show both answer and trail marker
      const answerSection = resultEl.querySelector('.answer-section');
      if (answerSection) {
        answerSection.style.display = 'block'; // Make sure it's visible
      }
      
      answerTextEl.textContent = answer;
      
      if (sources.length > 0) {
        const source = sources[0];
        addDebugLog(`🌿 Setting trail marker URL (with answer): ${source.url}`);
        
        try {
          if (!sourceTitleEl) {
            addDebugLog('🍂 sourceTitleEl not found!');
            return;
          }
          if (!sourceUrlEl) {
            addDebugLog('🍂 sourceUrlEl not found!');
            return;
          }
          
          sourceTitleEl.textContent = 'Trail Marker:';
          sourceUrlEl.textContent = source.url;
          sourceUrlEl.href = source.url; // Make it a proper link
          
          addDebugLog(`🌿 Source URL element text: "${sourceUrlEl.textContent}"`);
          addDebugLog(`🌿 Source URL element href: "${sourceUrlEl.href}"`);
          addDebugLog(`🌿 Source URL element display: "${window.getComputedStyle(sourceUrlEl).display}"`);
          addDebugLog(`🌿 Source URL element visibility: "${window.getComputedStyle(sourceUrlEl).visibility}"`);
          
          if (goToSourceBtnEl) {
            goToSourceBtnEl.onclick = () => {
              chrome.tabs.create({ url: source.url });
            };
          }
        } catch (error) {
          addDebugLog(`🍂 Error setting trail marker: ${error.message}`);
        }
      } else {
        addDebugLog('🌿 No sources available for trail marker (with answer)');
      }
    }
  }, 200);
}

// Show error with smooth animation
function showError(message) {
  errorTextEl.textContent = message;
  errorEl.classList.remove('hidden');
  addDebugLog(`🍂 Error: ${message}`);
  
  // Auto-hide error after 5 seconds
  setTimeout(() => {
    errorEl.classList.add('hidden');
  }, 5000);
}

// Hide error with smooth animation
function hideError() {
  errorEl.classList.add('hidden');
}

async function handleAnalyze() {
  // Prevent multiple simultaneous scouting operations
  if (isScouting) {
    addDebugLog('🌿 Scouting already in progress - ignoring duplicate request');
    return;
  }
  
  try {
    // Set scouting state
    isScouting = true;
    
    // Stop any existing mountaineering updates
    stopMountaineeringUpdates();
    
    // IMMEDIATELY disable the scout button to prevent double-clicks and race conditions
    analyzeBtnEl.disabled = true;
    analyzeBtnEl.classList.add('hidden');
    questionInputEl.classList.add('hidden');
    queryBtnEl.classList.add('hidden');
    
    // Update voice button visibility (will hide it since no entry field)
    updateVoiceButtonVisibility();
    
    addDebugLog('🌲 Starting trail reconnaissance...');
    showStatus('Scouting the trail...', 'working');
    
    // Get current tab URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tab.url;
    
    addDebugLog(`🍃 Current trail location: ${currentUrl}`);
    
    if (!currentUrl || currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://')) {
      throw new Error('Cannot scout this trail. Please navigate to a website first.');
    }
    
    // Extract domain from URL
    const domain = extractDomain(currentUrl);
    currentDomain = domain;
    addDebugLog(`🌿 Trail base camp: ${domain}`);
    
    // OPTIMIZED: Check if specific URL path already exists (faster than URL check)
    addDebugLog('🍃 Checking if specific URL path already mapped...');
    const checkResponse = await fetch(`${PATHFINDER_API_BASE}/sherpa/v1/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url: currentUrl,  // Check the specific URL path
        checkVectorIndex: true,  // Check if embeddings exist
        checkSpecificPath: true  // Flag to indicate we want path-specific checking
      }),
    });
    
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      addDebugLog(`🌿 Check response: ${checkData.exists ? 'Found' : 'Not found'} (${checkData.pages?.length || 0} pages)`);
      
      if (checkData.exists && checkData.pages && checkData.pages.length > 0) {
        addDebugLog('🌿 Specific URL path already mapped with waypoints');
        currentSiteId = checkData.siteId;
        isScouted = true;
        isScouting = false; // Reset scouting state
        
        // Stop any ongoing mountaineering updates
        stopMountaineeringUpdates();
        
        // Clear the scouting status
        hideStatus();
        
        await savePersistentState();
        
        // Show success message and query interface (like normal completion)
        hideScoutButton();
        showStatus('Trail scouted! Ready for your questions.', 'success');
        return;
      }
    }
    
    // Trail doesn't exist or has no waypoints, need to create and explore
    addDebugLog('🌳 Trail needs exploration, setting up base camp...');
    
    // Create site first
    const createSiteResponse = await fetch(`${PATHFINDER_API_BASE}/site`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: domain,
        startUrl: currentUrl,
      }),
    });
    
    if (!createSiteResponse.ok) {
      const errorText = await createSiteResponse.text();
      addDebugLog(`🍂 Base camp setup error: HTTP ${createSiteResponse.status} - ${errorText}`);
      throw new Error(`Failed to set up base camp: HTTP ${createSiteResponse.status} - ${errorText}`);
    }
    
    const siteData = await createSiteResponse.json();
    addDebugLog(`🌿 Base camp established: Site ID ${siteData.id} for ${siteData.domain}`);
    currentSiteId = siteData.id;
    
    // Now start exploring using the streaming crawl API
    addDebugLog('🌱 Starting trail exploration...');
    showStatus('Exploring the trail... This may take a minute.', 'working');
    
    // Reduce log verbosity during heavy crawling activity
    reduceLogVerbosity();
    
    // Hide input during scouting
    questionInputEl.classList.add('hidden');
    queryBtnEl.classList.add('hidden');
    
    // Update voice button visibility (will hide it since no entry field)
    updateVoiceButtonVisibility();
    
    // Start mountaineering status updates after 5 seconds
    const statusUpdateInterval = setTimeout(() => {
      startMountaineeringUpdates();
    }, 5000);
    
    // Use the streaming crawl endpoint which is more reliable
    const crawlUrl = `${PATHFINDER_API_BASE}/crawl/stream?siteId=${currentSiteId}&startUrl=${encodeURIComponent(currentUrl)}`;
    addDebugLog(`🍃 Exploration route: ${crawlUrl}`);
    
    try {
      const response = await fetch(crawlUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        addDebugLog(`🍂 Exploration error: HTTP ${response.status} - ${errorText}`);
        throw new Error(`Trail exploration failed: HTTP ${response.status} - ${errorText}`);
      }
      
      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              addDebugLog(`🦋 Trail progress: ${data.type} - ${data.message || data.url || ''}`);
              
              if (data.type === 'done') {
                addDebugLog('🌿 Trail exploration completed successfully');
                stopMountaineeringUpdates(); // Stop the mountaineering updates
                restoreLogVerbosity(); // Restore normal log verbosity
                isScouted = true;
                isScouting = false; // Reset scouting state
                await savePersistentState();
                
                hideScoutButton();
                showStatus('Trail scouted! Ready for your questions.', 'success');
                return;
              } else if (data.type === 'status' && data.message.includes('error')) {
                stopMountaineeringUpdates(); // Stop updates on error too
                restoreLogVerbosity(); // Restore normal log verbosity
                isScouting = false; // Reset scouting state
                throw new Error(`Trail exploration error: ${data.message}`);
              }
            } catch (e) {
              // Ignore parsing errors for non-JSON lines
            }
          }
        }
      }
      
    } catch (error) {
      addDebugLog(`🍂 Trail exploration stream error: ${error.message}`);
      stopMountaineeringUpdates(); // Stop updates on stream error
      restoreLogVerbosity(); // Restore normal log verbosity
      isScouting = false; // Reset scouting state
      throw error;
    }
    
  } catch (error) {
    console.error('Trail scouting error:', error);
    addDebugLog(`🍂 Trail scouting error: ${error.message}`);
    stopMountaineeringUpdates(); // Stop updates on any error
    restoreLogVerbosity(); // Restore normal log verbosity
    isScouting = false; // Reset scouting state
    
    // Re-enable the scout button on error
    analyzeBtnEl.disabled = false;
    analyzeBtnEl.classList.remove('hidden');
    
    showError(`Trail scouting failed: ${error.message}`);
  }
}

async function handleQuery() {
  try {
    const question = questionInputEl.value.trim();
    if (!question) {
      showError('Please ask Sherpa a question');
      return;
    }
    
    if (!currentSiteId || !isScouted) {
      showError('Please scout the trail first');
      return;
    }
    
    // Double-check that the website is still scouted (real-time verification)
    addDebugLog('🌿 Verifying website is still scouted before query...');
    const verifyResponse = await fetch(`${PATHFINDER_API_BASE}/sherpa/v1/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url: currentUrl,  // Check the specific URL path
        checkVectorIndex: true,
        checkSpecificPath: true  // Flag to indicate we want path-specific checking
      }),
    });
    
    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      if (!verifyData.exists || !verifyData.pages || verifyData.pages.length === 0) {
        addDebugLog('🍂 Website no longer scouted - clearing state and showing scout button');
        await clearWebsiteState();
        await showScoutButton();
        showError('Trail has been cleared. Please scout the trail again.');
        return;
      }
    } else {
      addDebugLog('🍂 Verification failed - treating as not scouted');
      await clearWebsiteState();
      await showScoutButton();
      showError('Unable to verify trail status. Please scout the trail again.');
      return;
    }
    
    addDebugLog(`🐦 Asking Sherpa: "${question}"`);
    showStatus('Consulting Sherpa...', 'working');
    
    // OPTIMIZED: Try Pathfinder's native fast endpoints first
    try {
      addDebugLog('🌿 Step 1: Using Pathfinder native search...');
      showStatus('Searching with Pathfinder...', 'working');
      
      // Try Pathfinder's native search endpoint (likely fastest)
      const searchResponse = await fetch(`${PATHFINDER_API_BASE}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId: currentSiteId,
          query: question,
          limit: 3,
          useVectorSearch: true,  // Enable vector search if available
          similarityThreshold: 0.7,
        }),
      });
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        addDebugLog(`🌿 Pathfinder search: ${searchData.results?.length || 0} relevant pages found`);
        
        if (searchData.results && searchData.results.length > 0) {
          showStatus('Found relevant pages, generating answer...', 'working');
          
          // Use Pathfinder's native query with pre-ranked results
          const queryResponse = await fetch(`${PATHFINDER_API_BASE}/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              siteId: currentSiteId,
              question: question,
              // Pass pre-ranked results for faster generation
              context: searchData.results.slice(0, 2).map(r => ({ 
                url: r.url, 
                title: r.title,
                relevance: r.relevance || r.similarity 
              })),
              usePreRankedResults: true
            }),
          });
          
          if (queryResponse.ok) {
            const data = await queryResponse.json();
            addDebugLog(`🌿 Pathfinder-optimized response: Answer generated (${data.sources?.length || 0} sources)`);
            
            currentAnswer = data.answer;
            currentSource = data.sources && data.sources.length > 0 ? data.sources[0] : null;
            
            showResult(data.answer, data.sources || []);
            showStatus("Sherpa's found a spot!", 'success');
            return;
          }
        }
      }
    } catch (pathfinderError) {
      addDebugLog(`🍂 Pathfinder native search failed, trying Sherpa endpoints: ${pathfinderError.message}`);
    }
    
    // Fallback: Try Sherpa's vector search
    try {
      addDebugLog('🌿 Step 2: Using Sherpa vector search...');
      showStatus('Using vector embeddings...', 'working');
      
      const vectorResponse = await fetch(`${PATHFINDER_API_BASE}/vector-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId: currentSiteId,
          query: question,
          limit: 3,
          useEmbeddings: true,
          similarityThreshold: 0.7,
        }),
      });
      
      if (vectorResponse.ok) {
        const vectorData = await vectorResponse.json();
        addDebugLog(`🌿 Vector search: ${vectorData.results?.length || 0} relevant pages found`);
        
        if (vectorData.results && vectorData.results.length > 0) {
          showStatus('Found relevant pages, generating answer...', 'working');
          
          const queryResponse = await fetch(`${PATHFINDER_API_BASE}/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              siteId: currentSiteId,
              question: question,
              context: vectorData.results.slice(0, 2).map(r => ({ 
                url: r.url, 
                title: r.title,
                similarity: r.similarity 
              })),
            }),
          });
          
          if (queryResponse.ok) {
            const data = await queryResponse.json();
            addDebugLog(`🌿 Vector-optimized response: Answer generated (${data.sources?.length || 0} sources)`);
            
            currentAnswer = data.answer;
            currentSource = data.sources && data.sources.length > 0 ? data.sources[0] : null;
            
            showResult(data.answer, data.sources || []);
            showStatus("Sherpa's found a spot!", 'success');
            return;
          }
        }
      }
    } catch (vectorError) {
      addDebugLog(`🍂 Vector search failed, using standard query: ${vectorError.message}`);
    }
    
    // Final fallback: Standard query
    addDebugLog('🌿 Final fallback: Using standard query...');
    showStatus('Generating answer...', 'working');
    
    const response = await fetch(`${PATHFINDER_API_BASE}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteId: currentSiteId,
        question: question,
      }),
    });
    
    addDebugLog(`🌊 Sherpa response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      addDebugLog(`🍂 Sherpa response error: HTTP ${response.status} - ${errorText}`);
      throw new Error(`Sherpa consultation failed: HTTP ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    addDebugLog(`🌿 Sherpa response: Answer generated (${data.sources?.length || 0} sources)`);
    
    // Display the answer
    currentAnswer = data.answer;
    currentSource = data.sources && data.sources.length > 0 ? data.sources[0] : null;
    
    showResult(data.answer, data.sources || []);
    showStatus("Sherpa's found a spot!", 'success');
    
  } catch (error) {
    console.error('Sherpa consultation error:', error);
    addDebugLog(`🍂 Sherpa consultation error: ${error.message}`);
    showError(`Sherpa consultation failed: ${error.message}`);
  }
}

// Helper function to extract domain from URL
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Voice Recognition Functions
function initializeVoiceRecognition() {
  addDebugLog('🎤 Initializing voice recognition...');
  addDebugLog(`🎤 Browser: ${navigator.userAgent}`);
  addDebugLog(`🎤 SpeechRecognition available: ${'SpeechRecognition' in window}`);
  addDebugLog(`🎤 webkitSpeechRecognition available: ${'webkitSpeechRecognition' in window}`);
  
  // Check if browser supports speech recognition
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    isVoiceSupported = true;
    addDebugLog('🎤 Voice recognition supported');
    
    try {
      // Initialize speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      
      // Configure recognition settings
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      // Set up event handlers
      recognition.onstart = handleVoiceStart;
      recognition.onresult = handleVoiceResult;
      recognition.onerror = handleVoiceError;
      recognition.onend = handleVoiceEnd;
      
      addDebugLog('🎤 Voice recognition initialized successfully');
    } catch (error) {
      addDebugLog(`🍂 Voice recognition initialization failed: ${error.message}`);
      isVoiceSupported = false;
    }
  } else {
    isVoiceSupported = false;
    addDebugLog('🍂 Voice recognition not supported in this browser');
  }
  
  // Voice button should be hidden by default (only shown in query mode)
  if (voiceBtnEl) {
    voiceBtnEl.style.display = 'none';
    addDebugLog('🎤 Voice button hidden by default');
    addDebugLog(`🎤 Voice button element: ${voiceBtnEl}`);
    addDebugLog(`🎤 Voice button parent: ${voiceBtnEl.parentElement}`);
  } else {
    addDebugLog('🍂 CRITICAL: voiceBtnEl is null! Voice button not found in DOM');
  }
}

// Note: Removed iframe and new tab methods - now using direct permission requests

// Simple rule: microphone only shows when there's an entry field AND microphone is working
function updateVoiceButtonVisibility() {
  if (!voiceBtnEl) return;
  
  const hasEntryField = questionInputEl && !questionInputEl.classList.contains('hidden');
  const micEnabled = isVoiceSupported && microphonePermissionGranted;
  
  if (hasEntryField && micEnabled) {
    voiceBtnEl.style.display = 'flex';
    voiceBtnEl.classList.remove('hidden');
  } else {
    voiceBtnEl.style.display = 'none';
    voiceBtnEl.classList.add('hidden');
  }
}

// Request microphone permission directly in popup context
async function requestMicrophonePermission() {
  addDebugLog('🎤 Starting microphone permission request...');
  
  // Don't request permission if we're in scout mode
  if (analyzeBtnEl.classList.contains('hidden') && queryBtnEl.classList.contains('hidden')) {
    addDebugLog('🍂 In scout mode - skipping microphone permission request');
    return;
  }
  
  if (!isVoiceSupported) {
    addDebugLog('🍂 Skipping microphone permission request - voice not supported');
    return;
  }

  // Check if permission is already granted
  if (microphonePermissionGranted) {
    addDebugLog('🎤 Microphone permission already granted - skipping request');
    updateVoiceButtonState('ready');
    showStatus('Microphone already ready for voice input!', 'success');
    setTimeout(() => hideStatus(), 2000);
    return;
  }

  // Request microphone permission directly in popup context
  try {
    addDebugLog('🎤 Requesting microphone permission directly...');
    
    // Show loading state
    updateVoiceButtonState('processing');
    showStatus('Requesting microphone access...', 'working');
    
    // Request microphone access directly
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    addDebugLog('🎤 Microphone permission granted!');
    
    // Test the stream to make sure it works
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
    
    // Update state
    microphonePermissionGranted = true;
    updateVoiceButtonState('ready');
    showStatus('Microphone ready for voice input!', 'success');
    
    // Update voice button visibility based on simple rule
    updateVoiceButtonVisibility();
    
    // Hide success message after 2 seconds
    setTimeout(() => {
      hideStatus();
    }, 2000);
    
  } catch (error) {
    addDebugLog(`🍂 Microphone permission denied: ${error.name}`);
    microphonePermissionGranted = false;
    
    // Only show error if we're in query mode
    if (!analyzeBtnEl.classList.contains('hidden') || !queryBtnEl.classList.contains('hidden')) {
      if (error.name === 'NotAllowedError') {
        showError('Microphone access denied. Please allow microphone access in your browser settings to use voice input.');
      } else if (error.name === 'NotFoundError') {
        showError('No microphone found. Please connect a microphone to use voice input.');
      } else {
        showError(`Microphone error: ${error.message}`);
      }
      
      // Hide voice button if permission denied
      if (voiceBtnEl) {
        voiceBtnEl.style.display = 'none';
      }
    }
    
    updateVoiceButtonState('error');
    updateVoiceButtonVisibility();
  }
}

function handleVoiceInput() {
  if (!isVoiceSupported) {
    showError('Voice input not supported in this browser');
    return;
  }
  
  if (isListening) {
    // Stop listening
    stopVoiceRecognition();
  } else {
    // Check microphone permission before starting
    if (microphonePermissionGranted) {
      startVoiceRecognition();
    } else {
      addDebugLog('🎤 Permission not granted, requesting via iframe...');
      showStatus('Requesting microphone permission...', 'working');
      requestMicrophonePermission();
    }
  }
}

async function checkMicrophonePermission() {
  // For iframe method, we track permission state directly
  addDebugLog(`🎤 Checking microphone permission: ${microphonePermissionGranted}`);
  return microphonePermissionGranted;
}

function startVoiceRecognition() {
  try {
    addDebugLog('🎤 Starting voice recognition...');
    isListening = true;
    updateVoiceButtonState('listening');
    showStatus('Listening... Speak your question', 'working');
    
    recognition.start();
  } catch (error) {
    addDebugLog(`🍂 Voice recognition start error: ${error.message}`);
    handleVoiceError({ error: 'start_failed' });
  }
}

function stopVoiceRecognition() {
  if (recognition && isListening) {
    addDebugLog('🎤 Stopping voice recognition...');
    recognition.stop();
  }
}

function handleVoiceStart() {
  addDebugLog('🎤 Voice recognition started - listening for speech');
  updateVoiceButtonState('listening');
}

function handleVoiceResult(event) {
  const transcript = event.results[0][0].transcript;
  addDebugLog(`🎤 Voice input received: "${transcript}"`);
  
  // Update the input field with the transcript
  questionInputEl.value = transcript;
  
  // Update voice button state
  updateVoiceButtonState('processing');
  showStatus('Processing your question...', 'working');
  
  // Small delay to show processing state, then trigger query
  setTimeout(() => {
    updateVoiceButtonState('default');
    hideStatus();
    
    // Auto-trigger query if we're in the right state
    if (isScouted && !queryBtnEl.classList.contains('hidden') && !queryBtnEl.disabled) {
      addDebugLog('🎤 Auto-triggering query from voice input');
      handleQuery();
    }
  }, 1000);
}

function handleVoiceError(event) {
  addDebugLog(`🍂 Voice recognition error: ${event.error}`);
  
  let errorMessage = 'Voice input failed';
  
  switch (event.error) {
    case 'no-speech':
      errorMessage = 'No speech detected. Please try again.';
      break;
    case 'audio-capture':
      errorMessage = 'Microphone not available. Please check permissions.';
      break;
    case 'not-allowed':
      errorMessage = 'Microphone permission denied. Please allow microphone access.';
      break;
    case 'network':
      errorMessage = 'Network error. Please check your connection.';
      break;
    case 'start_failed':
      errorMessage = 'Failed to start voice recognition. Please try again.';
      break;
    default:
      errorMessage = `Voice input error: ${event.error}`;
  }
  
  updateVoiceButtonState('error');
  showError(errorMessage);
  
  // Reset button state after error
  setTimeout(() => {
    updateVoiceButtonState('default');
  }, 3000);
}

function handleVoiceEnd() {
  addDebugLog('🎤 Voice recognition ended');
  isListening = false;
  updateVoiceButtonState('default');
}

function updateVoiceButtonState(state) {
  if (!voiceBtnEl) {
    addDebugLog('🍂 updateVoiceButtonState: voiceBtnEl is null');
    return;
  }
  
  // Remove all state classes
  voiceBtnEl.classList.remove('listening', 'processing', 'error', 'ready');
  
  // Add the new state class
  if (state !== 'default') {
    voiceBtnEl.classList.add(state);
  }
  
  // Update button disabled state
  voiceBtnEl.disabled = state === 'processing';
  
  // Update icon based on state
  const icon = voiceBtnEl.querySelector('.voice-icon');
  if (icon) {
    switch (state) {
      case 'listening':
        icon.textContent = '●';
        break;
      case 'processing':
        icon.textContent = '◐';
        break;
      case 'error':
        icon.textContent = '▲';
        break;
      case 'ready':
        icon.textContent = '●';
        break;
      default:
        icon.textContent = '○';
    }
  } else {
    addDebugLog('🍂 updateVoiceButtonState: voice-icon not found');
  }
}


// Test microphone permission function
function testMicrophonePermission() {
  addDebugLog('TEST: Manual microphone permission test');
  addDebugLog(`Voice button exists: ${!!voiceBtnEl}`);
  addDebugLog(`Voice supported: ${isVoiceSupported}`);
  addDebugLog(`Permission granted: ${microphonePermissionGranted}`);
  addDebugLog(`Method: Using new tab for microphone permission`);
  
  // Try to request permission
  requestMicrophonePermission();
}

function addDebugLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  
  // Add to buffer (fast operation)
  logBuffer.push(logEntry);
  
  // Keep only recent entries in buffer (prevent memory bloat)
  if (logBuffer.length > 1000) {
    logBuffer = logBuffer.slice(-500); // Keep last 500 entries
  }
  
  // Console log immediately (for debugging)
  console.log(logEntry);
  
  // Update display less frequently (performance optimization)
  if (!logUpdateInterval) {
    logUpdateInterval = setTimeout(updateLogDisplay, 100); // Update every 100ms
  }
}

// Update log display with throttling
function updateLogDisplay() {
  if (logBuffer.length === 0) return;
  
  // Show only the last N lines for performance
  const displayLines = logBuffer.slice(-logDisplayLimit);
  debugContentEl.textContent = displayLines.join('\n');
  debugContentEl.scrollTop = debugContentEl.scrollHeight;
  
  // Clear the interval
  logUpdateInterval = null;
}

function clearDebugLog() {
  // Clear both display and buffer
  debugContentEl.textContent = '';
  logBuffer = [];
  
  // Clear any pending update
  if (logUpdateInterval) {
    clearTimeout(logUpdateInterval);
    logUpdateInterval = null;
  }
}

// Copy debug log to clipboard
async function copyDebugLog() {
  try {
    // Copy the full buffer, not just displayed text
    const logText = logBuffer.join('\n');
    if (!logText.trim()) {
      addDebugLog('🍂 No log content to copy');
      return;
    }
    
    await navigator.clipboard.writeText(logText);
    addDebugLog('📋 Full log copied to clipboard!');
    
    // Visual feedback - briefly change button text
    const originalText = copyLogBtnEl.textContent;
    copyLogBtnEl.textContent = '✅ Copied!';
    copyLogBtnEl.style.background = '#10b981';
    
    setTimeout(() => {
      copyLogBtnEl.textContent = originalText;
      copyLogBtnEl.style.background = '#1a1a1a'; // Always return to black background
    }, 1500);
    
  } catch (error) {
    addDebugLog(`🍂 Failed to copy log: ${error.message}`);
    
    // Fallback: try to select the text
    try {
      const range = document.createRange();
      range.selectNodeContents(debugContentEl);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      addDebugLog('📋 Log selected - use Ctrl+C to copy');
    } catch (fallbackError) {
      addDebugLog(`🍂 Copy fallback failed: ${fallbackError.message}`);
    }
  }
}