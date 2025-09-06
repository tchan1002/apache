// API Configuration
const SHERPA_API_BASE = 'https://pathfinder-bay-mu.vercel.app/api/sherpa/v1';
const QUERY_API_BASE = 'https://pathfinder-bay-mu.vercel.app/api';

// State
let currentQuestion = '';
let currentAnswer = null;
let currentSource = null;
let currentSiteId = null;
let currentDomain = null;

// DOM Elements
const questionSectionEl = document.getElementById('question-section');
const questionInputEl = document.getElementById('question-input');
const checkBtnEl = document.getElementById('analyze-btn'); // Reuse the analyze button
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
  checkBtnEl.addEventListener('click', handleCheck);
  queryBtnEl.addEventListener('click', handleQuery);
  clearLogBtnEl.addEventListener('click', clearDebugLog);
  
  // Update button text
  checkBtnEl.textContent = '1. Check Site';
  
  addDebugLog('Sherpa extension loaded - ready to check sites');
});

async function handleCheck() {
  try {
    addDebugLog('🔍 Starting site check...');
    showStatus('Checking if site exists in database...', 'working');
    
    // Get current tab URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tab.url;
    
    addDebugLog(`🔍 Current tab URL: ${currentUrl}`);
    
    if (!currentUrl || currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://')) {
      throw new Error('Cannot check this page. Please navigate to a website first.');
    }
    
    // Check if site exists in database
    addDebugLog('📤 Sending check request...');
    const response = await fetch(`${SHERPA_API_BASE}/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: currentUrl }),
    });
    
    addDebugLog(`📥 Check response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      addDebugLog(`❌ Check response error: HTTP ${response.status} - ${errorText}`);
      throw new Error(`Check failed: HTTP ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    addDebugLog(`📊 Check response: ${JSON.stringify(data, null, 2)}`);
    
    if (!data.exists) {
      showError(`Site not found in database: ${data.domain}\n\nPlease crawl this site first using Pathfinder admin at:\nhttps://pathfinder-bay-mu.vercel.app/admin`);
      return;
    }
    
    if (data.pages.length === 0) {
      showError(`Site exists but no pages found: ${data.domain}\n\nCrawling may not be complete. Please check Pathfinder admin.`);
      return;
    }
    
    // Site exists with pages - show success
    currentSiteId = data.siteId;
    currentDomain = data.domain;
    
    addDebugLog(`✅ Site found: ${data.domain} with ${data.pageCount} pages`);
    showStatus(`Site found! ${data.pageCount} pages available for questions.`, 'success');
    showQueryButton();
    
  } catch (error) {
    console.error('Check error:', error);
    addDebugLog(`❌ Check error: ${error.message}`);
    showError(`Check failed: ${error.message}`);
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
      showError('Please check the site first');
      return;
    }
    
    addDebugLog(`❓ Asking question: "${question}"`);
    showStatus('Searching for answer...', 'working');
    
    // Use the existing query endpoint
    const response = await fetch(`${QUERY_API_BASE}/query`, {
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
    currentSource = data.sources && data.sources[0] ? data.sources[0] : null;
    
    showResult(data.answer, currentSource);
    
  } catch (error) {
    console.error('Query error:', error);
    addDebugLog(`❌ Query error: ${error.message}`);
    showError(`Query failed: ${error.message}`);
  }
}

function showQueryButton() {
  queryBtnEl.classList.remove('hidden');
  addDebugLog('✅ Query button shown');
}

function showStatus(message, type) {
  statusTextEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');
  resultEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  addDebugLog(`📊 Status: ${message}`);
}

function showResult(answer, source) {
  answerTextEl.textContent = answer;
  
  if (source) {
    sourceUrlEl.textContent = source.url;
    sourceTitleEl.textContent = source.title || 'Untitled';
    sourceUrlEl.href = source.url;
    goToSourceBtnEl.href = source.url;
    goToSourceBtnEl.classList.remove('hidden');
  } else {
    goToSourceBtnEl.classList.add('hidden');
  }
  
  resultEl.classList.remove('hidden');
  statusEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  addDebugLog('✅ Result displayed');
}

function showError(message) {
  errorTextEl.textContent = message;
  errorEl.classList.remove('hidden');
  statusEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  addDebugLog(`❌ Error: ${message}`);
}

function addDebugLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}\n`;
  debugContentEl.textContent += logEntry;
  debugEl.classList.remove('hidden');
  console.log(message);
}

function clearDebugLog() {
  debugContentEl.textContent = '';
  addDebugLog('Debug log cleared');
}