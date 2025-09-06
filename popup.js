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
const askBtnEl = document.getElementById('ask-btn');
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Focus on the question input
  questionInputEl.focus();
  
  // Set up event listeners
  askBtnEl.addEventListener('click', handleAsk);
  questionInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleAsk();
    }
  });
  
  goToSourceBtnEl.addEventListener('click', handleGoToSource);
  feedbackBtnEl.addEventListener('click', () => {
    feedbackEl.classList.remove('hidden');
  });
  
  yesBtnEl.addEventListener('click', () => submitFeedback(true));
  noBtnEl.addEventListener('click', () => submitFeedback(false));
});

async function handleAsk() {
  const question = questionInputEl.value.trim();
  if (!question) return;
  
  currentQuestion = question;
  askBtnEl.disabled = true;
  askBtnEl.textContent = 'Analyzing...';
  
  try {
    // Step 1: Get current tab URL
    showStatus('Getting current website URL...', 'working');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      throw new Error('No active tab found');
    }
    
    console.log('🔍 Current tab URL:', tab.url);
    addDebugLog(`🔍 Current tab URL: ${tab.url}`);
    showStatus(`Found website: ${tab.url}`, 'working');
    
    // Step 2: Send to Pathfinder for analysis
    showStatus('Sending website to Pathfinder for analysis...', 'working');
    console.log('📤 Sending analyze request to:', `${SHERPA_API_BASE}/analyze`);
    addDebugLog(`📤 Sending analyze request to: ${SHERPA_API_BASE}/analyze`);
    
    const analyzeResponse = await fetch(`${SHERPA_API_BASE}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start_url: tab.url,
        user_id: 'sherpa-extension',
      }),
    });

    console.log('📥 Analyze response status:', analyzeResponse.status);
    addDebugLog(`📥 Analyze response status: ${analyzeResponse.status}`);
    
    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error('❌ Analyze response error:', errorText);
      throw new Error(`Analysis failed: HTTP ${analyzeResponse.status} - ${errorText}`);
    }

    const analyzeData = await analyzeResponse.json();
    console.log('📊 Analyze response data:', analyzeData);
    addDebugLog(`📊 Analyze response: ${JSON.stringify(analyzeData, null, 2)}`);
    
    if (analyzeData.mode === 'cached') {
      // Use cached results immediately
      showStatus('Using cached analysis results...', 'working');
      currentSiteId = analyzeData.job_id; // For cached results, job_id is the siteId
      console.log('✅ Using cached jobId as siteId:', currentSiteId);
      addDebugLog(`✅ Using cached jobId as siteId: ${currentSiteId}`);
      await queryWithQuestion();
    } else if (analyzeData.mode === 'started') {
      // Poll for completion
      showStatus('Pathfinder is crawling the website...', 'working');
      currentJobId = analyzeData.job_id;
      console.log('🔄 Started crawling job:', currentJobId);
      addDebugLog(`🔄 Started crawling job: ${currentJobId}`);
      await pollForCompletion();
    } else {
      console.error('❌ Unknown analysis response mode:', analyzeData.mode);
      throw new Error(`Unknown analysis response mode: ${analyzeData.mode}`);
    }
  } catch (error) {
    console.error('❌ Analysis error:', error);
    showError(`Analysis failed: ${error.message}`);
  } finally {
    askBtnEl.disabled = false;
    askBtnEl.textContent = 'Ask';
  }
}

async function pollForCompletion() {
  const maxAttempts = 30; // 30 seconds max
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
        throw new Error(`Job status failed: HTTP ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('📊 Job status data:', data);
      
      if (data.status === 'done') {
        showStatus('Crawling completed! Getting results...', 'working');
        console.log('✅ Job completed, getting results...');
        
        // Get results to get the siteId
        const resultsResponse = await fetch(`${SHERPA_API_BASE}/results/head?job_id=${currentJobId}`);
        console.log('📥 Results response:', resultsResponse.status);
        
        if (!resultsResponse.ok) {
          const errorText = await resultsResponse.text();
          console.error('❌ Results error:', errorText);
          throw new Error(`Results failed: HTTP ${resultsResponse.status} - ${errorText}`);
        }
        
        const results = await resultsResponse.json();
        console.log('📊 Results data:', results);
        
        currentSiteId = currentJobId; // Use jobId as siteId for now
        console.log('✅ Using jobId as siteId for query:', currentSiteId);
        await queryWithQuestion();
      } else if (data.status === 'error') {
        console.error('❌ Job failed with error status');
        throw new Error('Analysis failed - job returned error status');
      } else if (attempts >= maxAttempts) {
        console.error('❌ Polling timeout after', maxAttempts, 'attempts');
        throw new Error(`Analysis timeout after ${maxAttempts} seconds`);
      } else {
        // Update progress
        const progress = data.progress;
        if (progress) {
          showStatus(`Crawling... (${progress.pages_scanned}/${progress.pages_total_est || '?'} pages)`, 'working');
          console.log('📈 Crawling progress:', progress);
        } else {
          showStatus(`Crawling... (${data.status})`, 'working');
          console.log('📈 Job status:', data.status);
        }
        
        // Continue polling
        attempts++;
        setTimeout(poll, 1000);
      }
    } catch (error) {
      console.error('❌ Polling error:', error);
      showError(`Crawling failed: ${error.message}`);
    }
  };
  
  poll();
}

async function queryWithQuestion() {
  try {
    showStatus('Pathfinder is searching for your answer...', 'working');
    console.log('🔍 Sending query to Pathfinder...');
    addDebugLog(`🔍 Sending query to Pathfinder...`);
    console.log('📤 Query request:', {
      jobId: currentSiteId,
      question: currentQuestion,
      endpoint: `${SHERPA_API_BASE}/query`
    });
    addDebugLog(`📤 Query request: jobId=${currentSiteId}, question="${currentQuestion}", endpoint=${SHERPA_API_BASE}/query`);
    
    // Step 2: Query the analyzed content using the Sherpa query endpoint
    const response = await fetch(`${SHERPA_API_BASE}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobId: currentSiteId, // Use the jobId/siteId from analysis
        question: currentQuestion,
      }),
    });

    console.log('📥 Query response status:', response.status);
    addDebugLog(`📥 Query response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Query response error:', errorText);
      throw new Error(`Query failed: HTTP ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📊 Query response data:', data);
    addDebugLog(`📊 Query response: ${JSON.stringify(data, null, 2)}`);
    
    if (data.answer && data.sources && data.sources.length > 0) {
      showStatus('Pathfinder found an answer!', 'working');
      console.log('✅ Answer found:', data.answer);
      console.log('✅ Sources found:', data.sources.length);
      console.log('✅ Best source:', data.sources[0]);
      addDebugLog(`✅ Answer found: ${data.answer}`);
      addDebugLog(`✅ Sources found: ${data.sources.length}`);
      addDebugLog(`✅ Best source: ${JSON.stringify(data.sources[0], null, 2)}`);
      
      currentAnswer = data.answer;
      currentSource = data.sources[0]; // Use the first (best) source
      
      showStatus('Displaying results...', 'working');
      setTimeout(() => showResult(), 500); // Brief delay to show success message
    } else {
      console.error('❌ No answer or sources in response:', data);
      throw new Error(`No answer found. Response: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.error('❌ Query error:', error);
    showError(`Query failed: ${error.message}`);
  }
}

function extractSiteIdFromUrl(url) {
  // For now, we'll use a simple approach
  // In a real implementation, you might need to get the siteId from the current page
  // or from a previous analysis
  try {
    const domain = new URL(url).hostname;
    // This is a placeholder - in reality, you'd need to map domains to siteIds
    return domain.replace(/\./g, '-');
  } catch {
    return 'unknown';
  }
}

function showResult() {
  hideAll();
  
  console.log('🎉 Showing results:', {
    answer: currentAnswer,
    source: currentSource
  });
  
  // Show answer
  answerTextEl.textContent = currentAnswer;
  
  // Show source
  sourceUrlEl.textContent = currentSource.url;
  sourceTitleEl.textContent = currentSource.title || 'Untitled';
  
  console.log('✅ Pathfinder returned URL:', currentSource.url);
  console.log('✅ Pathfinder returned title:', currentSource.title);
  
  // Show result section
  resultEl.classList.remove('hidden');
  
  // Show buttons
  goToSourceBtnEl.classList.remove('hidden');
  feedbackBtnEl.classList.remove('hidden');
}

function handleGoToSource() {
  if (currentSource && currentSource.url) {
    chrome.tabs.update({ url: currentSource.url });
    window.close();
  }
}

function showStatus(text, type) {
  hideAll();
  statusTextEl.textContent = text;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');
}

function showError(text) {
  hideAll();
  errorTextEl.textContent = text;
  errorEl.classList.remove('hidden');
}

function hideAll() {
  questionSectionEl.classList.add('hidden');
  statusEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  feedbackEl.classList.add('hidden');
  debugEl.classList.add('hidden');
}

function addDebugLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}\n`;
  debugContentEl.textContent += logEntry;
  debugEl.classList.remove('hidden');
  console.log(message);
}

async function submitFeedback(wasHelpful) {
  try {
    // For now, we'll just close the popup
    // In a real implementation, you might want to send feedback to an analytics endpoint
    console.log('Feedback submitted:', { question: currentQuestion, wasHelpful });
    
    // Close popup
    window.close();
  } catch (error) {
    console.error('Feedback error:', error);
    // Close popup anyway
    window.close();
  }
}
