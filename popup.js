// API Configuration
const PATHFINDER_API_BASE = 'https://pathfinder-bay-mu.vercel.app/api';

// State
let currentQuestion = '';
let currentAnswer = null;
let currentSource = null;
let currentSiteId = null;

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
const clearLogBtnEl = document.getElementById('clear-log-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  analyzeBtnEl.addEventListener('click', handleAnalyze);
  queryBtnEl.addEventListener('click', handleQuery);
  clearLogBtnEl.addEventListener('click', clearDebugLog);
  
  addDebugLog('Sherpa guide ready - ready to scout trails');
});

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
    addDebugLog(`🌿 Trail base camp: ${domain}`);
    
    // OPTIMIZED: Check if domain already exists (faster than URL check)
    addDebugLog('🍃 Checking if domain already mapped...');
    const checkResponse = await fetch(`${PATHFINDER_API_BASE}/sherpa/v1/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url: currentUrl,  // API extracts domain internally
        checkVectorIndex: true  // Check if embeddings exist
      }),
    });
    
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      addDebugLog(`🌿 Check response: ${JSON.stringify(checkData, null, 2)}`);
      
      if (checkData.exists && checkData.pages && checkData.pages.length > 0) {
        addDebugLog('🌿 Trail already mapped with waypoints');
        showStatus('Trail already scouted! Ready for your questions.', 'success');
        currentSiteId = checkData.siteId;
        showQueryButton();
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
                showStatus('Trail scouted! Ready for your questions.', 'success');
                showQueryButton();
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
    
    if (!currentSiteId) {
      showError('Please scout the trail first');
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

function showQueryButton() {
  queryBtnEl.style.display = 'block';
  questionSectionEl.style.display = 'block';
}

function showStatus(message, type) {
  statusEl.style.display = 'block';
  statusTextEl.textContent = message;
  statusEl.className = `status ${type}`;
  addDebugLog(`🌿 Trail status: ${message}`);
}

function showError(message) {
  errorEl.style.display = 'block';
  errorTextEl.textContent = message;
  addDebugLog(`🍂 Error: ${message}`);
}

function showResult(answer, sources) {
  resultEl.style.display = 'block';
  
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