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
  
  addDebugLog('Sherpa extension loaded - ready to analyze sites');
});

async function handleAnalyze() {
  try {
    addDebugLog('🔍 Starting site analysis...');
    showStatus('Starting site analysis...', 'working');
    
    // Get current tab URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tab.url;
    
    addDebugLog(`🔍 Current tab URL: ${currentUrl}`);
    
    if (!currentUrl || currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://')) {
      throw new Error('Cannot analyze this page. Please navigate to a website first.');
    }
    
    // Extract domain from URL
    const domain = extractDomain(currentUrl);
    addDebugLog(`🔍 Domain: ${domain}`);
    
    // Check if site already exists
    addDebugLog('🔍 Checking if site already exists...');
    const checkResponse = await fetch(`${PATHFINDER_API_BASE}/sherpa/v1/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: currentUrl }),
    });
    
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      addDebugLog(`📊 Check response: ${JSON.stringify(checkData, null, 2)}`);
      
      if (checkData.exists && checkData.pages && checkData.pages.length > 0) {
        addDebugLog('✅ Site already analyzed with pages');
        showStatus('Site already analyzed! Ready for questions.', 'success');
        currentSiteId = checkData.siteId;
        showQueryButton();
        return;
      }
    }
    
    // Site doesn't exist or has no pages, need to create and crawl
    addDebugLog('🔍 Site needs crawling, creating site...');
    
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
      addDebugLog(`❌ Create site error: HTTP ${createSiteResponse.status} - ${errorText}`);
      throw new Error(`Failed to create site: HTTP ${createSiteResponse.status} - ${errorText}`);
    }
    
    const siteData = await createSiteResponse.json();
    addDebugLog(`✅ Site created: ${JSON.stringify(siteData, null, 2)}`);
    currentSiteId = siteData.id;
    
    // Now start crawling using the streaming crawl API
    addDebugLog('🚀 Starting crawl...');
    showStatus('Crawling site... This may take a few minutes.', 'working');
    
    // Use the streaming crawl endpoint which is more reliable
    const crawlUrl = `${PATHFINDER_API_BASE}/crawl/stream?siteId=${currentSiteId}&startUrl=${encodeURIComponent(currentUrl)}`;
    addDebugLog(`🔗 Crawl URL: ${crawlUrl}`);
    
    try {
      const response = await fetch(crawlUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        addDebugLog(`❌ Crawl error: HTTP ${response.status} - ${errorText}`);
        throw new Error(`Crawling failed: HTTP ${response.status} - ${errorText}`);
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
              addDebugLog(`📡 Crawl event: ${data.type} - ${data.message || data.url || ''}`);
              
              if (data.type === 'done') {
                addDebugLog('✅ Crawling completed successfully');
                showStatus('Analysis complete! Ready to ask questions.', 'success');
                showQueryButton();
                return;
              } else if (data.type === 'status' && data.message.includes('error')) {
                throw new Error(`Crawling error: ${data.message}`);
              }
            } catch (e) {
              // Ignore parsing errors for non-JSON lines
            }
          }
        }
      }
      
    } catch (error) {
      addDebugLog(`❌ Crawl stream error: ${error.message}`);
      throw error;
    }
    
  } catch (error) {
    console.error('Analysis error:', error);
    addDebugLog(`❌ Analysis error: ${error.message}`);
    showError(`Analysis failed: ${error.message}`);
  }
}

async function handleQuery() {
  try {
    const question = questionInputEl.value.trim();
    if (!question) {
      showError('Please enter a question');
      return;
    }
    
    if (!currentSiteId) {
      showError('Please analyze the site first');
      return;
    }
    
    addDebugLog(`🔍 Asking question: "${question}"`);
    showStatus('Searching for answer...', 'working');
    
    // Use the existing query API
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
    
    addDebugLog(`📥 Query response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      addDebugLog(`❌ Query response error: HTTP ${response.status} - ${errorText}`);
      throw new Error(`Query failed: HTTP ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    addDebugLog(`📊 Query response: ${JSON.stringify(data, null, 2)}`);
    
    // Display the answer
    currentAnswer = data.answer;
    currentSource = data.sources && data.sources.length > 0 ? data.sources[0] : null;
    
    showResult(data.answer, data.sources || []);
    showStatus('Answer found!', 'success');
    
  } catch (error) {
    console.error('Query error:', error);
    addDebugLog(`❌ Query error: ${error.message}`);
    showError(`Query failed: ${error.message}`);
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
  addDebugLog(`📊 Status: ${message}`);
}

function showError(message) {
  errorEl.style.display = 'block';
  errorTextEl.textContent = message;
  addDebugLog(`❌ Error: ${message}`);
}

function showResult(answer, sources) {
  resultEl.style.display = 'block';
  answerTextEl.textContent = answer;
  
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