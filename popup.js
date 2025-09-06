// API Configuration
const API_BASE = 'https://pathfinder-bay-mu.vercel.app/api/sherpa/v1';

// State
let currentJobId = null;
let currentTop = null;
let currentNext = null;
let currentRemaining = 0;

// DOM Elements
const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('status-text');
const resultEl = document.getElementById('result');
const resultTitleEl = document.getElementById('result-title');
const resultUrlEl = document.getElementById('result-url');
const alternativeEl = document.getElementById('alternative');
const alternativeTitleEl = document.getElementById('alternative-title');
const alternativeUrlEl = document.getElementById('alternative-url');
const nextBtnEl = document.getElementById('next-btn');
const feedbackBtnEl = document.getElementById('feedback-btn');
const feedbackEl = document.getElementById('feedback');
const yesBtnEl = document.getElementById('yes-btn');
const noBtnEl = document.getElementById('no-btn');
const errorEl = document.getElementById('error');
const errorTextEl = document.getElementById('error-text');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get current tab URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      showError('No active tab found');
      return;
    }

    // Start analysis
    await startAnalysis(tab.url);
  } catch (error) {
    console.error('Popup initialization error:', error);
    showError('Failed to initialize');
  }
});

async function startAnalysis(url) {
  try {
    showStatus('Working...', 'working');
    
    // Call analyze endpoint
    const response = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start_url: url,
        user_id: 'sherpa-extension',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.mode === 'cached') {
      // Immediate result
      currentJobId = data.job_id;
      currentTop = data.top;
      currentNext = data.next;
      currentRemaining = data.remaining;
      showResult();
    } else if (data.mode === 'started') {
      // Poll for completion
      currentJobId = data.job_id;
      await pollForCompletion();
    } else {
      throw new Error('Unknown response mode');
    }
  } catch (error) {
    console.error('Analysis error:', error);
    showError('Sorry, we got lost :(. Try another question');
  }
}

async function pollForCompletion() {
  const maxAttempts = 30; // 30 seconds max
  let attempts = 0;
  
  const poll = async () => {
    try {
      const response = await fetch(`${API_BASE}/jobs/${currentJobId}/status`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.status === 'done') {
        // Get results
        const resultsResponse = await fetch(`${API_BASE}/results/head?job_id=${currentJobId}`);
        if (!resultsResponse.ok) throw new Error(`HTTP ${resultsResponse.status}`);
        
        const results = await resultsResponse.json();
        currentTop = results.top;
        currentNext = results.next;
        currentRemaining = results.remaining;
        showResult();
      } else if (data.status === 'error') {
        throw new Error('Analysis failed');
      } else if (attempts >= maxAttempts) {
        throw new Error('Analysis timeout');
      } else {
        // Update progress
        const progress = data.progress;
        if (progress) {
          showStatus(`Working... (${progress.pages_scanned}/${progress.pages_total_est || '?'} pages)`, 'working');
        }
        
        // Continue polling
        attempts++;
        setTimeout(poll, 1000);
      }
    } catch (error) {
      console.error('Polling error:', error);
      showError('Sorry, we got lost :(. Try another question');
    }
  };
  
  poll();
}

function showResult() {
  hideAll();
  
  // Navigate to top page
  chrome.tabs.update({ url: currentTop.url });
  
  // Show result
  resultTitleEl.textContent = 'We took you to:';
  resultUrlEl.textContent = currentTop.url;
  resultEl.classList.remove('hidden');
  
  // Show alternative if available
  if (currentNext) {
    alternativeTitleEl.textContent = 'Next best:';
    alternativeUrlEl.textContent = currentNext.url;
    alternativeEl.classList.remove('hidden');
    nextBtnEl.classList.remove('hidden');
  }
  
  // Show feedback button
  feedbackBtnEl.classList.remove('hidden');
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
  statusEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  feedbackEl.classList.add('hidden');
}

// Event Listeners
nextBtnEl.addEventListener('click', async () => {
  if (!currentNext) return;
  
  try {
    // Navigate to next page
    chrome.tabs.update({ url: currentNext.url });
    
    // Advance the queue
    const response = await fetch(`${API_BASE}/results/advance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: currentJobId,
        consumed_url: currentNext.url,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      currentNext = data.next;
      currentRemaining = data.remaining;
      
      // Update UI
      if (currentNext) {
        alternativeTitleEl.textContent = 'Next best:';
        alternativeUrlEl.textContent = currentNext.url;
      } else {
        alternativeEl.classList.add('hidden');
        nextBtnEl.classList.add('hidden');
      }
    }
  } catch (error) {
    console.error('Advance error:', error);
  }
});

feedbackBtnEl.addEventListener('click', () => {
  feedbackEl.classList.remove('hidden');
});

yesBtnEl.addEventListener('click', () => {
  submitFeedback(true);
});

noBtnEl.addEventListener('click', () => {
  submitFeedback(false);
});

async function submitFeedback(wasCorrect) {
  try {
    await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: currentJobId,
        landed_url: currentTop.url,
        was_correct: wasCorrect,
        chosen_rank: 1,
        user_id: 'sherpa-extension',
        timestamp: new Date().toISOString(),
      }),
    });
    
    // Close popup
    window.close();
  } catch (error) {
    console.error('Feedback error:', error);
    // Close popup anyway
    window.close();
  }
}
