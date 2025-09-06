// API Configuration
const API_BASE = 'https://pathfinder-bay-mu.vercel.app/api';

// State
let currentQuestion = '';
let currentAnswer = null;
let currentSource = null;

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
  askBtnEl.textContent = 'Asking...';
  
  try {
    showStatus('Searching for answer...', 'working');
    
    // Get current tab URL for context
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      throw new Error('No active tab found');
    }
    
    // Call query endpoint
    const response = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: question,
        siteId: extractSiteIdFromUrl(tab.url),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.answer && data.sources && data.sources.length > 0) {
      currentAnswer = data.answer;
      currentSource = data.sources[0]; // Use the first (best) source
      showResult();
    } else {
      throw new Error('No answer found');
    }
  } catch (error) {
    console.error('Query error:', error);
    showError('Sorry, we got lost :(. Try another question');
  } finally {
    askBtnEl.disabled = false;
    askBtnEl.textContent = 'Ask';
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
  
  // Show answer
  answerTextEl.textContent = currentAnswer;
  
  // Show source
  sourceUrlEl.textContent = currentSource.url;
  sourceTitleEl.textContent = currentSource.title || 'Untitled';
  
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
