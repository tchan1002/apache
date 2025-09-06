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

// DOM Elements
const questionSectionEl = document.getElementById('question-section');
const questionInputEl = document.getElementById('question-input');
const analyzeBtnEl = document.getElementById('analyze-btn');
const queryBtnEl = document.getElementById('query-btn');
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
const debugContentEl = document.getElementById('debug-content');
const copyLogBtnEl = document.getElementById('copy-log-btn');
const clearLogBtnEl = document.getElementById('clear-log-btn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  analyzeBtnEl.addEventListener('click', handleAnalyze);
  queryBtnEl.addEventListener('click', handleQuery);
  copyLogBtnEl.addEventListener('click', copyDebugLog);
  clearLogBtnEl.addEventListener('click', clearDebugLog);
  
  // Load persistent state
  await loadPersistentState();
  
  // Check if current website is already scouted
  await checkWebsiteStatus();
  
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

// Check if current website is already scouted (REAL-TIME CHECK)
async function checkWebsiteStatus() {
  try {
    // Get current tab URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabUrl = tab.url;
    
    if (!tabUrl || tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://')) {
      await showScoutButton();
      return;
    }
    
    // Always update current URL and domain
    currentUrl = tabUrl;
    currentDomain = extractDomain(tabUrl);
    
    addDebugLog(`🍃 Real-time website check: ${tabUrl}`);
    
    // ALWAYS perform real-time check with Pathfinder API
    // This ensures we detect if a previously scouted website has been deleted
    // Check for the specific URL path, not just the domain
    const checkResponse = await fetch(`${PATHFINDER_API_BASE}/sherpa/v1/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url: tabUrl,  // Check the specific URL path
        checkVectorIndex: true,
        checkSpecificPath: true  // Flag to indicate we want path-specific checking
      }),
    });
    
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      addDebugLog(`🌿 Real-time check response: ${JSON.stringify(checkData, null, 2)}`);
      
      if (checkData.exists && checkData.pages && checkData.pages.length > 0) {
        // Specific URL path is currently scouted in database
        currentSiteId = checkData.siteId;
        isScouted = true;
        await savePersistentState();
        
        addDebugLog('🌿 Specific URL path confirmed scouted - showing query interface');
        hideScoutButton();
        showQueryButton();
        showStatus('Trail already scouted! Ready for your questions.', 'success');
        return;
      } else {
        // URL path not scouted or was deleted from database
        addDebugLog('🌿 URL path not scouted or was deleted - clearing state and showing scout button');
        await clearWebsiteState();
        await showScoutButton();
        return;
      }
    } else {
      // API check failed - treat as not scouted
      addDebugLog(`🍂 API check failed (HTTP ${checkResponse.status}) - treating as not scouted`);
      await clearWebsiteState();
      await showScoutButton();
      return;
    }
    
  } catch (error) {
    addDebugLog(`🍂 Real-time website check failed: ${error.message}`);
    // On error, clear state and show scout button as fallback
    await clearWebsiteState();
    await showScoutButton();
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
  currentAnswer = null;
  currentSource = null;
  
  // Hide query elements first
  queryBtnEl.classList.add('hidden');
  questionInputEl.classList.add('hidden');
  statusEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  
  // Show scout button and question section
  analyzeBtnEl.classList.remove('hidden');
  questionSectionEl.classList.remove('hidden');
  
  // Debug: Check if button is visible
  addDebugLog(`🌿 Scout button classes: ${analyzeBtnEl.className}`);
  addDebugLog(`🌿 Question section classes: ${questionSectionEl.className}`);
  addDebugLog(`🌿 Scout button display: ${window.getComputedStyle(analyzeBtnEl).display}`);
}

// Show query button and input with smooth animation
function showQueryButton() {
  addDebugLog('🌿 Showing query section with animation');
  
  // Show query button and input section
  setTimeout(() => {
    queryBtnEl.classList.remove('hidden');
    questionInputEl.classList.remove('hidden');
    questionSectionEl.classList.remove('hidden');
  }, 200);
}

// Show status with smooth animation
function showStatus(message, type) {
  statusTextEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');
  
  // Add loading animation for working status
  if (type === 'working') {
    statusTextEl.classList.add('loading-dots');
  } else {
    statusTextEl.classList.remove('loading-dots');
  }
  
  addDebugLog(`🌿 Trail status: ${message}`);
}

// Hide status with smooth animation
function hideStatus() {
  statusEl.classList.add('hidden');
}

// Show result with smooth animation
function showResult(answer, sources) {
  addDebugLog('🌿 Showing result with animation');
  
  // Hide status first
  hideStatus();
  
  // Show result
  setTimeout(() => {
    resultEl.classList.remove('hidden');
    
    // Check if answer is "I don't know" and provide special message
    if (answer.toLowerCase().includes("i don't know") || answer.toLowerCase().includes("i do not know")) {
      answerTextEl.textContent = "Sherpa's not sure, but check out the trail marker below!";
    } else {
      answerTextEl.textContent = answer;
    }
    
    if (sources.length > 0) {
      const source = sources[0];
      sourceTitleEl.textContent = source.title || 'Untitled';
      sourceUrlEl.textContent = source.url;
      goToSourceBtnEl.onclick = () => {
        chrome.tabs.create({ url: source.url });
      };
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
  try {
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
      addDebugLog(`🌿 Check response: ${JSON.stringify(checkData, null, 2)}`);
      
      if (checkData.exists && checkData.pages && checkData.pages.length > 0) {
        addDebugLog('🌿 Specific URL path already mapped with waypoints');
        currentSiteId = checkData.siteId;
        isScouted = true;
        await savePersistentState();
        
        hideScoutButton();
        showStatus('Trail already scouted! Ready for your questions.', 'success');
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
    addDebugLog(`🌿 Base camp established: ${JSON.stringify(siteData, null, 2)}`);
    currentSiteId = siteData.id;
    
    // Now start exploring using the streaming crawl API
    addDebugLog('🌱 Starting trail exploration...');
    showStatus('Exploring the trail... This may take a few minutes.', 'working');
    
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
                isScouted = true;
                await savePersistentState();
                
                hideScoutButton();
                showStatus('Trail scouted! Ready for your questions.', 'success');
                return;
              } else if (data.type === 'status' && data.message.includes('error')) {
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
      throw error;
    }
    
  } catch (error) {
    console.error('Trail scouting error:', error);
    addDebugLog(`🍂 Trail scouting error: ${error.message}`);
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
        addDebugLog(`🌿 Pathfinder search found ${searchData.results?.length || 0} relevant pages`);
        
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
            addDebugLog(`🌿 Pathfinder-optimized response: ${JSON.stringify(data, null, 2)}`);
            
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
        addDebugLog(`🌿 Vector search found ${vectorData.results?.length || 0} relevant pages`);
        
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
            addDebugLog(`🌿 Vector-optimized response: ${JSON.stringify(data, null, 2)}`);
            
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
    addDebugLog(`🌿 Sherpa response: ${JSON.stringify(data, null, 2)}`);
    
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

function addDebugLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  debugContentEl.textContent += logEntry + '\n';
  debugContentEl.scrollTop = debugContentEl.scrollHeight;
  console.log(logEntry);
}

function clearDebugLog() {
  debugContentEl.textContent = '';
}

// Copy debug log to clipboard
async function copyDebugLog() {
  try {
    const logText = debugContentEl.textContent;
    if (!logText.trim()) {
      addDebugLog('🍂 No log content to copy');
      return;
    }
    
    await navigator.clipboard.writeText(logText);
    addDebugLog('📋 Log copied to clipboard!');
    
    // Visual feedback - briefly change button text
    const originalText = copyLogBtnEl.textContent;
    copyLogBtnEl.textContent = '✅ Copied!';
    copyLogBtnEl.style.background = '#10b981';
    
    setTimeout(() => {
      copyLogBtnEl.textContent = originalText;
      copyLogBtnEl.style.background = '#3b82f6';
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