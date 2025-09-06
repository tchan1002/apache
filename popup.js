// API Configuration
const SHERPA_API_BASE = 'https://pathfinder-bay-mu.vercel.app/api/sherpa/v1';
const QUERY_API_BASE = 'https://pathfinder-bay-mu.vercel.app/api';

// State
let currentQuestion = '';
let currentAnswer = null;
let currentSource = null;
let currentSiteId = null;
let currentJobId = null;

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
  checkBtnEl.textContent = '1. Analyze Site';
  
  addDebugLog('Sherpa extension loaded - ready to check sites');
});

async function handleCheck() {
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
    
    // Send analyze request to trigger crawling
    addDebugLog('📤 Sending analyze request...');
    const response = await fetch(`${SHERPA_API_BASE}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        start_url: currentUrl,
        domain_limit: null,
        user_id: null,
        max_pages: null
      }),
    });
    
    addDebugLog(`📥 Analyze response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      addDebugLog(`❌ Analyze response error: HTTP ${response.status} - ${errorText}`);
      throw new Error(`Analysis failed: HTTP ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    addDebugLog(`📊 Analyze response: ${JSON.stringify(data, null, 2)}`);
    
    if (data.mode === 'cached') {
      // Site already analyzed recently
      addDebugLog('✅ Site already analyzed (cached)');
      showStatus('Site already analyzed! Ready for questions.', 'success');
      showQueryButton();
      return;
    }
    
    if (data.mode === 'started') {
      // Crawling started - wait for completion
      currentJobId = data.job_id;
      addDebugLog(`🔄 Crawling started, job ID: ${currentJobId}`);
      showStatus('Crawling started... Waiting for completion...', 'working');
      
      // Start polling for completion
      await pollForCompletion();
    } else {
      throw new Error(`Unexpected response mode: ${data.mode}`);
    }
    
  } catch (error) {
    console.error('Analysis error:', error);
    addDebugLog(`❌ Analysis error: ${error.message}`);
    showError(`Analysis failed: ${error.message}`);
  }
}

async function pollForCompletion() {
  const maxAttempts = 60; // 5 minutes max (poll every 5 seconds)
  let attempts = 0;
  
  const poll = async () => {
    try {
      console.log(`🔄 Polling job status (attempt ${attempts + 1}/${maxAttempts}):`, currentJobId);
      showStatus(`Crawling... (checking progress ${attempts + 1}/${maxAttempts})`, 'working');
      
      const response = await fetch(`${SHERPA_API_BASE}/jobs/${currentJobId}/status`);
      console.log('📥 Job status response:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Job status error:', errorText);
        addDebugLog(`❌ Job status error: HTTP ${response.status} - ${errorText}`);
        throw new Error(`Job status failed: HTTP ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('📊 Job status data:', data);
      addDebugLog(`📊 Job status: ${data.status}`);
      
      if (data.status === 'done') {
        console.log('✅ Job completed successfully');
        addDebugLog('✅ Crawling completed successfully');
        showStatus('Analysis complete! Ready to ask questions.', 'success');
        showQueryButton();
        return;
      } else if (data.status === 'error') {
        console.error('❌ Job failed with error status');
        addDebugLog(`❌ Job failed: ${data.error_message || 'Unknown error'}`);
        throw new Error(`Analysis failed - job returned error status: ${data.error_message || 'Unknown error'}`);
      } else if (attempts >= maxAttempts) {
        console.error('❌ Polling timeout after', maxAttempts, 'attempts');
        addDebugLog(`❌ Polling timeout after ${maxAttempts} attempts`);
        throw new Error(`Analysis timeout after ${maxAttempts} seconds`);
      } else {
        // Update progress
        const progress = data.progress;
        if (progress && progress.pages_scanned > 0) {
          showStatus(`Crawling... (${progress.pages_scanned} pages found)`, 'working');
          console.log('📈 Crawling progress:', progress);
          addDebugLog(`📈 Progress: ${progress.pages_scanned} pages found`);
        } else {
          showStatus(`Crawling... (${data.status})`, 'working');
          console.log('📈 Job status:', data.status);
          addDebugLog(`📈 Status: ${data.status}`);
        }
        
        attempts++;
        setTimeout(poll, 10000); // Poll every 10 seconds
      }
    } catch (error) {
      console.error('Polling error:', error);
      addDebugLog(`❌ Polling error: ${error.message}`);
      throw error;
    }
  };
  
  await poll();
}

async function handleQuery() {
  try {
    const question = questionInputEl.value.trim();
    if (!question) {
      showError('Please enter a question');
      return;
    }
    
    if (!currentJobId) {
      showError('Please analyze the site first');
      return;
    }
    
    addDebugLog(`❓ Asking question: "${question}"`);
    showStatus('Searching for answer...', 'working');
    
    // Use the Sherpa query endpoint with jobId
    const response = await fetch(`${SHERPA_API_BASE}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobId: currentJobId,
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