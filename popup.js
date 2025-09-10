// Sherpa 2 (Apache) - Voice-First Assistant
// Minimal voice interface with persistent listening

// State management
let recognition = null;
let isListening = false;
let isVoiceSupported = false;
let microphonePermissionGranted = false;
let currentState = 'idle'; // idle, listening, processing, ready, error

// DOM elements
const sherpaCircle = document.getElementById('sherpa-circle');
const sherpaIcon = document.getElementById('sherpa-icon');
const statusText = document.getElementById('status-text');

// Debug log elements
const debugEl = document.getElementById('debug');
const debugContentEl = document.getElementById('debug-content');
const debugHeaderEl = document.getElementById('debug-header');
const copyLogBtnEl = document.getElementById('copy-log-btn');
const clearLogBtnEl = document.getElementById('clear-log-btn');
const logToggleBtnEl = document.getElementById('log-toggle-btn');
const logToggleIconEl = document.querySelector('.log-toggle-icon');

// Log management
let logBuffer = [];
let logUpdateInterval = null;
const MAX_LOG_ENTRIES = 100;

// Voice recognition timeout
let voiceTimeout = null;
const VOICE_TIMEOUT_MS = 10000; // 10 seconds of silence

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  addDebugLog('🌲 Sherpa 2 (Apache) - Voice-First Assistant loaded');
  
  // Set up debug log event handlers
  setupDebugLogHandlers();
  
  // Initialize log as collapsed
  debugEl.classList.add('collapsed');
  document.body.classList.remove('log-expanded');
  logToggleIconEl.textContent = '+';
  
  // Initialize voice recognition
  await initializeVoiceRecognition();
  
  // Set up click handler
  sherpaCircle.addEventListener('click', handleSherpaClick);
  
  // Update initial state
  updateState('idle');
});

// Initialize voice recognition
async function initializeVoiceRecognition() {
  addDebugLog('🎤 Initializing voice recognition...');
  
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
      updateState('ready');
    } catch (error) {
      addDebugLog(`🍂 Voice recognition initialization failed: ${error.message}`);
      isVoiceSupported = false;
      updateState('error');
    }
  } else {
    isVoiceSupported = false;
    addDebugLog('🍂 Voice recognition not supported in this browser');
    updateState('error');
  }
}

// Handle Sherpa circle click
async function handleSherpaClick() {
  addDebugLog('🖱️ Sherpa circle clicked');
  
  if (currentState === 'idle' || currentState === 'ready') {
    addDebugLog('🎤 Starting voice input...');
    await startListening();
  } else if (currentState === 'listening') {
    addDebugLog('🎤 Stopping voice input...');
    stopListening();
  } else if (currentState === 'error') {
    addDebugLog('🔄 Retrying voice recognition...');
    // Try to reinitialize
    await initializeVoiceRecognition();
  }
}

// Start listening for voice input
async function startListening() {
  if (!isVoiceSupported) {
    addDebugLog('🍂 Voice not supported');
    updateState('error');
    return;
  }
  
  // Request microphone permission if needed
  if (!microphonePermissionGranted) {
    addDebugLog('🎤 Requesting microphone permission...');
    try {
      await requestMicrophonePermission();
    } catch (error) {
      addDebugLog(`🍂 Microphone permission denied: ${error.message}`);
      updateState('error');
      return;
    }
  }
  
  try {
    addDebugLog('🎤 Starting voice recognition...');
    isListening = true;
    updateState('listening');
    
    // Start timeout for silence detection
    startVoiceTimeout();
    
    recognition.start();
  } catch (error) {
    addDebugLog(`🍂 Voice recognition start error: ${error.message}`);
    updateState('error');
  }
}

// Stop listening
function stopListening() {
  if (recognition && isListening) {
    console.log('🎤 Stopping voice recognition...');
    recognition.stop();
  }
  
  // Clear timeout and reset state
  if (voiceTimeout) {
    clearTimeout(voiceTimeout);
    voiceTimeout = null;
  }
  isListening = false;
  updateState('ready');
}

// Request microphone permission
async function requestMicrophonePermission() {
  console.log('🎤 Requesting microphone permission...');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Test the stream
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);
    
    // Check if we can read audio data
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    // Stop the tracks
    stream.getTracks().forEach(track => track.stop());
    audioContext.close();
    
    microphonePermissionGranted = true;
    console.log('🎤 Microphone permission granted');
  } catch (error) {
    console.error('🍂 Microphone permission denied:', error);
    throw error;
  }
}

// Start voice timeout
function startVoiceTimeout() {
  if (voiceTimeout) {
    clearTimeout(voiceTimeout);
  }
  
  voiceTimeout = setTimeout(() => {
    console.log('🎤 Voice timeout - stopping due to silence');
    stopListening();
  }, VOICE_TIMEOUT_MS);
}

// Voice recognition event handlers
function handleVoiceStart() {
  addDebugLog('🎤 Voice recognition started');
  updateState('listening');
}

function handleVoiceResult(event) {
  const transcript = event.results[0][0].transcript;
  addDebugLog(`🎤 Voice input received: "${transcript}"`);
  
  // Update last transcript time
  if (voiceTimeout) {
    clearTimeout(voiceTimeout);
    startVoiceTimeout();
  }
  
  // Process the voice command
  processVoiceCommand(transcript);
}

function handleVoiceError(event) {
  addDebugLog(`🍂 Voice recognition error: ${event.error}`);
  
  let errorMessage = 'Voice input failed';
  
  switch (event.error) {
    case 'no-speech':
      errorMessage = 'No speech detected';
      break;
    case 'audio-capture':
      errorMessage = 'Microphone not available';
      break;
    case 'not-allowed':
      errorMessage = 'Microphone permission denied';
      break;
    case 'network':
      errorMessage = 'Network error';
      break;
    default:
      errorMessage = `Voice error: ${event.error}`;
  }
  
  updateState('error');
  setTimeout(() => {
    updateState('ready');
  }, 3000);
}

function handleVoiceEnd() {
  addDebugLog('🎤 Voice recognition ended');
  isListening = false;
  updateState('ready');
  
  // Clear timeout
  if (voiceTimeout) {
    clearTimeout(voiceTimeout);
    voiceTimeout = null;
  }
}

// Process voice commands
async function processVoiceCommand(transcript) {
  addDebugLog(`🧠 Processing voice command: "${transcript}"`);
  updateState('processing');
  
  const command = transcript.toLowerCase().trim();
  
  try {
    // Check for wake word
    if (command.includes('hey sherpa') || command.includes('hey sherpa 2')) {
      addDebugLog('🎯 Wake word detected');
      speakResponse("I'm listening. What can I help you with?");
      updateState('ready');
    return;
  }
  
    // Navigation commands
    if (command.includes('take me to') || command.includes('go to') || command.includes('navigate to')) {
      addDebugLog('🧭 Processing navigation command');
      await handleNavigationCommand(command);
    }
    // On-page assistance
    else if (command.includes('where is') || command.includes('find') || command.includes('show me')) {
      addDebugLog('🔍 Processing on-page command');
      await handleOnPageCommand(command);
    }
    // General help
    else if (command.includes('help') || command.includes('what can you do')) {
      addDebugLog('❓ Processing help command');
      handleHelpCommand();
    }
    // Fallback - web search
    else {
      addDebugLog('🔍 Processing web search command');
      await handleWebSearchCommand(command);
    }
    
  } catch (error) {
    addDebugLog(`🍂 Error processing voice command: ${error.message}`);
    speakResponse("Sorry, I couldn't process that command. Please try again.");
    updateState('ready');
  }
}

// Handle navigation commands
async function handleNavigationCommand(command) {
  addDebugLog(`🧭 Handling navigation command: "${command}"`);
  
  // Extract destination from command
  let destination = command
    .replace(/take me to|go to|navigate to/gi, '')
    .trim();
  
  // Clean up common words
  destination = destination
    .replace(/^(the|a|an)\s+/i, '')
    .trim();
  
  addDebugLog(`🎯 Extracted destination: "${destination}"`);
  
  if (!destination) {
    addDebugLog('❓ No destination provided');
    speakResponse("Where would you like me to take you?");
    updateState('ready');
    return;
  }
  
  // Try to construct URL
  let url = destination;
  
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Check if it looks like a domain
    if (url.includes('.') && !url.includes(' ')) {
      url = 'https://' + url;
      addDebugLog(`🌐 Added https:// protocol: ${url}`);
    } else {
      // Treat as search query
      url = `https://www.google.com/search?q=${encodeURIComponent(destination)}`;
      addDebugLog(`🔍 Treating as search query: ${url}`);
    }
  }
  
  addDebugLog(`🌐 Navigating to: ${url}`);
  speakResponse(`Opening ${destination}`);
  
  // Navigate to the URL
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tab.id, { url: url });
    addDebugLog('✅ Navigation successful');
    updateState('ready');
  } catch (error) {
    addDebugLog(`🍂 Navigation error: ${error.message}`);
    speakResponse("Sorry, I couldn't navigate to that destination.");
    updateState('ready');
  }
}

// Handle on-page assistance commands
async function handleOnPageCommand(command) {
  addDebugLog(`🔍 Handling on-page command: "${command}"`);
  
  // Extract search term from command
  let searchTerm = command
    .replace(/where is|find|show me/gi, '')
    .trim();
  
  addDebugLog(`🎯 Extracted search term: "${searchTerm}"`);
  
  if (!searchTerm) {
    addDebugLog('❓ No search term provided');
    speakResponse("What would you like me to find on this page?");
    updateState('ready');
    return;
  }
  
  addDebugLog(`🔍 Searching for: "${searchTerm}"`);
  speakResponse(`Looking for ${searchTerm} on this page`);
  
  // Send message to content script to search the page
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    addDebugLog(`📨 Sending search message to tab: ${tab.id}`);
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'searchOnPage',
      searchTerm: searchTerm
    });
    
    addDebugLog(`📨 Received response: ${JSON.stringify(response)}`);
    
    if (response && response.found) {
      addDebugLog(`✅ Found ${response.results.length} matches`);
      speakResponse(`Found ${searchTerm}. ${response.message}`);
    } else {
      addDebugLog('❌ No matches found');
      speakResponse(`I couldn't find ${searchTerm} on this page.`);
    }
  } catch (error) {
    addDebugLog(`🍂 On-page search error: ${error.message}`);
    speakResponse("Sorry, I couldn't search this page.");
  }
  
  updateState('ready');
}

// Handle help command
function handleHelpCommand() {
  addDebugLog('❓ Handling help command');
  
  const helpText = "I can help you navigate to websites, find elements on pages, or search the web. Try saying 'take me to google.com' or 'find the search button'.";
  speakResponse(helpText);
  updateState('ready');
}

// Handle web search commands
async function handleWebSearchCommand(command) {
  addDebugLog(`🔍 Handling web search command: "${command}"`);
  
  speakResponse(`Searching for ${command}`);
  
  // Use Google search
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(command)}`;
  addDebugLog(`🔍 Search URL: ${searchUrl}`);
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(tab.id, { url: searchUrl });
    addDebugLog('✅ Web search navigation successful');
    updateState('ready');
  } catch (error) {
    addDebugLog(`🍂 Web search error: ${error.message}`);
    speakResponse("Sorry, I couldn't perform that search.");
    updateState('ready');
  }
}

// Text-to-speech function
function speakResponse(text) {
  addDebugLog(`🔊 Speaking: "${text}"`);
  
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    speechSynthesis.speak(utterance);
  } else {
    addDebugLog('🍂 Speech synthesis not supported');
  }
}

// Update UI state
function updateState(state) {
  addDebugLog(`🔄 State change: ${currentState} → ${state}`);
  currentState = state;
  
  // Remove all state classes
  sherpaCircle.classList.remove('listening', 'processing', 'ready', 'error');
  statusText.classList.remove('listening', 'processing', 'ready', 'error');
  
  // Add new state class
  if (state !== 'idle') {
    sherpaCircle.classList.add(state);
    statusText.classList.add(state);
  }
  
  // Update icon and text
    switch (state) {
    case 'idle':
      sherpaIcon.textContent = '○';
      statusText.textContent = 'Click to activate';
      break;
      case 'listening':
      sherpaIcon.textContent = '●';
      statusText.textContent = 'Listening...';
        break;
      case 'processing':
      sherpaIcon.textContent = '◐';
      statusText.textContent = 'Processing...';
        break;
      case 'ready':
      sherpaIcon.textContent = '○';
      statusText.textContent = 'Ready to help';
        break;
    case 'error':
      sherpaIcon.textContent = '▲';
      statusText.textContent = 'Error - Click to retry';
      break;
  }
}

// Debug logging functions
function setupDebugLogHandlers() {
  // Copy log button
  copyLogBtnEl.addEventListener('click', copyDebugLog);
  
  // Clear log button
  clearLogBtnEl.addEventListener('click', clearDebugLog);
  
  // Toggle log button
  logToggleBtnEl.addEventListener('click', toggleDebugLog);
}

function addDebugLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  
  // Add to buffer
  logBuffer.push(logEntry);
  
  // Keep only recent entries
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer = logBuffer.slice(-MAX_LOG_ENTRIES);
  }
  
  // Console log immediately
  console.log(logEntry);
  
  // Update display with throttling
  if (!logUpdateInterval) {
    logUpdateInterval = setTimeout(updateLogDisplay, 100);
  }
}

function updateLogDisplay() {
  if (logBuffer.length === 0) return;
  
  // Show more lines since we have more space
  const displayLines = logBuffer.slice(-80);
  debugContentEl.textContent = displayLines.join('\n');
  debugContentEl.scrollTop = debugContentEl.scrollHeight;
  
  // Clear the interval
  logUpdateInterval = null;
}

function clearDebugLog() {
  debugContentEl.textContent = '';
  logBuffer = [];
  
  if (logUpdateInterval) {
    clearTimeout(logUpdateInterval);
    logUpdateInterval = null;
  }
  
  addDebugLog('🧹 Debug log cleared');
}

async function copyDebugLog() {
  try {
    const logText = logBuffer.join('\n');
    if (!logText.trim()) {
      addDebugLog('🍂 No log content to copy');
      return;
    }
    
    await navigator.clipboard.writeText(logText);
    addDebugLog('📋 Log copied to clipboard!');
    
    // Visual feedback
    const originalText = copyLogBtnEl.textContent;
    copyLogBtnEl.textContent = '✅ Copied!';
    copyLogBtnEl.style.background = '#16a34a';
    
    setTimeout(() => {
      copyLogBtnEl.textContent = originalText;
      copyLogBtnEl.style.background = '#404040';
    }, 1500);
    
  } catch (error) {
    addDebugLog(`🍂 Failed to copy log: ${error.message}`);
  }
}

function toggleDebugLog() {
  debugEl.classList.toggle('collapsed');
  document.body.classList.toggle('log-expanded');
  
  // Update toggle button icon
  if (debugEl.classList.contains('collapsed')) {
    logToggleIconEl.textContent = '+';
    addDebugLog('🌲 Debug log collapsed');
  } else {
    logToggleIconEl.textContent = '−';
    addDebugLog('🌲 Debug log expanded');
  }
}
