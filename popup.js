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

// Voice recognition timeout (not used in continuous mode)
// let voiceTimeout = null;
// const VOICE_TIMEOUT_MS = 10000; // 10 seconds of silence

// Wake word detection
let wakeWordDetected = false;
const WAKE_WORDS = ['hey sherpa', 'sherpa', 'apache', 'hey'];

// State management
let lastStateChange = 0;
const STATE_DEBOUNCE_MS = 500; // Minimum time between state changes
let wakeWordTimeout = null;
const WAKE_WORD_TIMEOUT_MS = 8000; // 8 seconds to allow full string registration

// Page scraping and link mapping
let pageMap = {
  title: '',
  url: '',
  links: [],
  headings: [],
  lastScraped: null
};

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  addDebugLog('🌲 Sherpa 2 (Apache) - Voice-First Assistant loaded');
  
  // Set up debug log event handlers
  setupDebugLogHandlers();
  
  // Initialize log as collapsed
  debugEl.classList.add('collapsed');
  document.body.classList.remove('log-expanded');
  logToggleIconEl.textContent = '+';
  
  // Make sure toggle button is visible
  logToggleBtnEl.style.display = 'block';
  
  // Initialize voice recognition
  await initializeVoiceRecognition();
  
  // Set up click handler
  sherpaCircle.addEventListener('click', handleSherpaClick);
  
  // Add spacebar support for voice input
  document.addEventListener('keydown', handleSpaceKey);
  
  // Scrape current page for links and content
  await scrapeCurrentPage();
  
  // Start listening automatically
  addDebugLog('🎤 Starting automatic voice recognition...');
  await startListening();
  
  // Set up periodic state checking to ensure UI reflects microphone status
  setInterval(ensureMicrophoneState, 3000); // Check every 3 seconds to reduce flickering
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
      
      // Configure recognition settings for always listening
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      // Set up event handlers
      recognition.onstart = handleVoiceStart;
      recognition.onresult = handleVoiceResult;
      recognition.onerror = handleVoiceError;
      recognition.onend = handleVoiceEnd;
      
      addDebugLog('🎤 Voice recognition initialized successfully');
      updateState('idle');
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

// Handle Space key press for voice input
function handleSpaceKey(event) {
  if (event.code === 'Space') {
    // Prevent default space behavior (scrolling)
    event.preventDefault();
    
    if (currentState === 'idle' || currentState === 'ready') {
      addDebugLog('⌨️ Space key pressed - starting voice input');
      startListening();
    } else if (currentState === 'listening') {
      addDebugLog('⌨️ Space key pressed - stopping voice input');
      stopListening();
    } else if (currentState === 'error') {
      addDebugLog('⌨️ Space key pressed - retrying voice recognition');
      initializeVoiceRecognition();
    }
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
  
  // Test microphone access first
  if (!microphonePermissionGranted) {
    addDebugLog('🎤 Testing microphone access...');
    const hasAccess = await testMicrophoneAccess();
    
    if (hasAccess) {
      addDebugLog('🎤 Microphone access confirmed - mic working!');
      microphonePermissionGranted = true;
      addDebugLog('🎤 Mic working - ready for voice input');
    } else {
      addDebugLog('🎤 Microphone access denied, opening permission page...');
      try {
        await requestMicrophonePermission();
      } catch (error) {
        addDebugLog(`🍂 Microphone permission denied: ${error.message}`);
        updateState('error');
        return;
      }
    }
  } else {
    addDebugLog('🎤 Microphone permission already granted - mic working!');
  }
  
  try {
    addDebugLog('🎤 Starting continuous voice recognition - microphone will begin recording...');
    isListening = true;
    updateState('listening');
    
    // No timeout needed for continuous mode
    addDebugLog('🎤 Microphone ready for continuous voice input!');
    
    recognition.start();
  } catch (error) {
    addDebugLog(`🍂 Voice recognition start error: ${error.message}`);
    isListening = false;
    updateState('error');
  }
}

// Stop listening
function stopListening() {
  if (recognition && isListening) {
    addDebugLog('🎤 Stopping voice recognition - microphone will stop recording...');
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

// Request microphone permission using separate tab
async function requestMicrophonePermission() {
  addDebugLog('🎤 Requesting microphone permission via separate tab...');
  
  return new Promise((resolve, reject) => {
    // Open permission page in a new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL('permission.html'),
      active: true
    }, (tab) => {
      if (chrome.runtime.lastError) {
        addDebugLog(`🍂 Failed to open permission tab: ${chrome.runtime.lastError.message}`);
        reject(new Error(chrome.runtime.lastError.message));
      return;
    }
    
      addDebugLog(`🎤 Permission tab opened with ID: ${tab.id}`);
      
      // Listen for messages from the permission tab
      const handleMessage = (message, sender, sendResponse) => {
        if (sender.tab && sender.tab.id === tab.id) {
          if (message.type === 'MICROPHONE_PERMISSION_GRANTED') {
            addDebugLog('🎤 Microphone permission granted via tab');
            microphonePermissionGranted = true;
            chrome.tabs.remove(tab.id);
            resolve();
          } else if (message.type === 'MICROPHONE_PERMISSION_DENIED') {
            addDebugLog(`🍂 Microphone permission denied via tab: ${message.error}`);
            microphonePermissionGranted = false;
            chrome.tabs.remove(tab.id);
            reject(new Error(message.error || 'Permission denied'));
          } else if (message.type === 'CLOSE_IFRAME') {
            addDebugLog('🎤 Permission tab closed by user');
            chrome.tabs.remove(tab.id);
            reject(new Error('Permission request cancelled'));
          }
        }
      };
      
      // Listen for tab removal (user closed tab)
      const handleTabRemoved = (tabId) => {
        if (tabId === tab.id) {
          addDebugLog('🎤 Permission tab was closed by user');
          reject(new Error('Permission request cancelled'));
        }
      };
      
      chrome.runtime.onMessage.addListener(handleMessage);
      chrome.tabs.onRemoved.addListener(handleTabRemoved);
      
      // Cleanup function
      const cleanup = () => {
        chrome.runtime.onMessage.removeListener(handleMessage);
        chrome.tabs.onRemoved.removeListener(handleTabRemoved);
      };
      
      // Timeout after 60 seconds
  setTimeout(() => {
        addDebugLog('🍂 Permission request timed out');
        cleanup();
        chrome.tabs.remove(tab.id);
        reject(new Error('Permission request timed out'));
      }, 60000);
    });
  });
}

// Test microphone access directly
async function testMicrophoneAccess() {
  addDebugLog('🎤 Testing microphone access...');
  
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
    
    addDebugLog('🎤 Microphone access confirmed - mic working!');
    return true;
  } catch (error) {
    addDebugLog(`🍂 Microphone access test failed: ${error.name}`);
    return false;
  }
}

// Start voice timeout
// Voice timeout function removed - not needed in continuous mode

// Voice recognition event handlers
function handleVoiceStart() {
  addDebugLog('🎤 Voice recognition started - microphone actively recording');
  isListening = true;
  // Ensure we're in listening state when mic is active
  if (currentState !== 'listening') {
    updateState('listening');
  }
}

function handleVoiceResult(event) {
  // Get the latest result (most recent speech)
  const result = event.results[event.results.length - 1];
  const transcript = result[0].transcript.toLowerCase().trim();
  const isFinal = result.isFinal;
  
  // Ensure we're in listening state when processing speech
  if (isListening && currentState !== 'listening' && currentState !== 'processing') {
    updateState('listening');
  }
  
  // Show that we're actively processing speech
  if (!isFinal) {
    addDebugLog(`🎤 Microphone actively recording: "${transcript}..."`);
    // Only switch to picking-up if we're in listening state
    if (currentState === 'listening') {
      updateState('picking-up');
    }
    return;
  }
  
  addDebugLog(`🎤 Voice input received: "${transcript}"`);
  
  // Check for wake words - only process complete wake words
  const containsWakeWord = WAKE_WORDS.some(wakeWord => {
    const lowerTranscript = transcript.toLowerCase();
    const lowerWakeWord = wakeWord.toLowerCase();
    // Only match if it's a complete wake word, not partial
    return lowerTranscript === lowerWakeWord || lowerTranscript.endsWith(' ' + lowerWakeWord) || lowerTranscript.startsWith(lowerWakeWord + ' ');
  });
  
  // Check for clear command patterns (commands that don't need wake words)
  const isClearCommand = isClearCommandPattern(transcript);
  
  if (containsWakeWord && !wakeWordDetected) {
    wakeWordDetected = true;
    addDebugLog(`🎤 Wake word detected: "${transcript}"`);
    speakResponse("I'm listening. What can I help you with?");
    updateState('ready');
    
    // Set timeout to reset wake word detection after 8 seconds
    if (wakeWordTimeout) {
      clearTimeout(wakeWordTimeout);
    }
    wakeWordTimeout = setTimeout(() => {
      wakeWordDetected = false;
      addDebugLog('🔄 Wake word detection reset - ready for new commands');
    }, WAKE_WORD_TIMEOUT_MS);
    
    return; // Continue listening for the actual command
  }
  
  // Process commands if wake word was detected or it's a clear command
  if (wakeWordDetected || isClearCommand) {
    addDebugLog(`🎤 Processing command: "${transcript}"`);
    processVoiceCommand(transcript);
  } else {
    addDebugLog(`🎤 Ignoring speech (no wake word or clear command): "${transcript}"`);
    // Return to listening state after processing speech
    if (isListening) {
      updateState('listening');
    }
  }
}

// Check if speech contains clear command patterns
function isClearCommandPattern(transcript) {
  const clearCommandPatterns = [
    'take me to',
    'go to',
    'navigate to',
    'where is',
    'find',
    'show me',
    'what links',
    'what are the links',
    'show links',
    'available links',
    'analyze page',
    'what\'s on this page',
    'page summary',
    'help',
    'what can you do'
  ];
  
  return clearCommandPatterns.some(pattern => 
    transcript.includes(pattern.toLowerCase())
  );
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
  addDebugLog('🎤 Voice recognition ended - microphone stopped recording');
  isListening = false;
  wakeWordDetected = false; // Reset wake word detection
  
  // Only update state if we're not processing a command
  if (currentState !== 'processing') {
    updateState('ready');
  }
  
  // No timeout in continuous mode
  
  // Restart continuous listening after a short delay
  setTimeout(() => {
    if (isVoiceSupported && recognition) {
      try {
        addDebugLog('🔄 Restarting continuous voice recognition - microphone will resume recording');
        recognition.start();
        } catch (error) {
        addDebugLog(`🍂 Failed to restart continuous recognition: ${error.message}`);
        updateState('error');
      }
    }
  }, 100);
}

// Process voice commands
async function processVoiceCommand(transcript) {
  addDebugLog(`🧠 Processing voice command: "${transcript}"`);
  // Ensure we're not listening while processing
  isListening = false;
  updateState('processing');
  
  // Reset wake word detection after processing a command
  wakeWordDetected = false;
  if (wakeWordTimeout) {
    clearTimeout(wakeWordTimeout);
    wakeWordTimeout = null;
  }
  
  const command = transcript.toLowerCase().trim();
  
  try {
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
    // Link suggestions
    else if (command.includes('what links') || command.includes('show links') || command.includes('available links')) {
      addDebugLog('🔗 Processing link suggestions command');
      await handleLinkSuggestionsCommand(command);
    }
    // Page analysis
    else if (command.includes('analyze page') || command.includes('what\'s on this page') || command.includes('page summary')) {
      addDebugLog('📄 Processing page analysis command');
      await handlePageAnalysisCommand(command);
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
  
  // Restart listening after processing
  setTimeout(() => {
    if (isVoiceSupported && recognition && !isListening) {
      try {
        addDebugLog('🔄 Restarting listening after command processing');
        isListening = true;
        // Only start if not already running
        if (recognition && recognition.state !== 'started') {
          recognition.start();
        } else {
          addDebugLog('🎤 Recognition already running, skipping restart');
        }
      } catch (error) {
        addDebugLog(`🍂 Failed to restart listening: ${error.message}`);
      }
    }
  }, 500);
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
  
  // First, check if we have scraped links and can find a match
  if (pageMap.links.length === 0) {
    addDebugLog('🔍 No links cached, attempting to scrape page...');
    await scrapeCurrentPageWithRetry();
  }
  
  if (pageMap.links.length > 0) {
    const matchingLinks = findMatchingLinks(destination);
    
    if (matchingLinks.length > 0) {
      const bestMatch = matchingLinks[0];
      addDebugLog(`🔗 Found matching link: "${bestMatch.text}" -> ${bestMatch.href}`);
      
      speakResponse(`I found a link for "${destination}". Taking you to ${bestMatch.text}.`);
      
      try {
        await chrome.tabs.create({ url: bestMatch.href, active: false });
        addDebugLog('✅ Navigation to scraped link successful - opened in background tab');
        updateState('ready');
        return;
      } catch (error) {
        addDebugLog(`🍂 Navigation to scraped link error: ${error.message}`);
        // Fall through to regular navigation
      }
    }
  }
  
  // Fallback to regular URL construction
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
    await chrome.tabs.create({ url: url, active: false });
    addDebugLog('✅ Navigation successful - opened in background tab');
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
  
  const helpText = "I can help you navigate to websites, find elements on pages, analyze the current page, and suggest links. Try saying 'take me to google.com', 'what links are available', 'analyze this page', or 'find the search button'.";
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
    await chrome.tabs.create({ url: searchUrl, active: false });
    addDebugLog('✅ Web search navigation successful - opened in background tab');
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
  const now = Date.now();
  
  // Debounce rapid state changes
  if (now - lastStateChange < STATE_DEBOUNCE_MS && state === 'picking-up') {
    return; // Skip rapid picking-up state changes
  }
  
  addDebugLog(`🔄 State change: ${currentState} → ${state}`);
  currentState = state;
  lastStateChange = now;
  
  // Remove all state classes
  sherpaCircle.classList.remove('listening', 'processing', 'ready', 'error', 'idle', 'picking-up');
  statusText.classList.remove('listening', 'processing', 'ready', 'error', 'idle', 'picking-up');
  
  // Always add the state class
  sherpaCircle.classList.add(state);
  statusText.classList.add(state);
  
  // Update icon and text based on microphone status
  switch (state) {
    case 'idle':
      sherpaIcon.textContent = '○';
      statusText.textContent = 'Ready';
      break;
    case 'listening':
      sherpaIcon.textContent = '●';
      statusText.textContent = '🎤 Listening...';
      break;
    case 'picking-up':
      sherpaIcon.textContent = '●';
      statusText.textContent = '🎤 Picking up speech...';
      break;
    case 'processing':
      sherpaIcon.textContent = '◐';
      statusText.textContent = '🧠 Processing...';
      break;
    case 'ready':
      sherpaIcon.textContent = '●';
      if (microphonePermissionGranted) {
        statusText.textContent = '🎤 Mic working - Ready to help';
      } else {
        statusText.textContent = 'Ready to help';
      }
      break;
    case 'error':
      sherpaIcon.textContent = '▲';
      statusText.textContent = 'Error - Click to retry';
      break;
  }
}

// Ensure UI state reflects microphone activity
function ensureMicrophoneState() {
  // Simple state correction - only fix obvious mismatches
  if (isListening && currentState === 'idle') {
    addDebugLog('🔄 Correcting state - microphone is active but UI shows idle');
    updateState('listening');
  } else if (!isListening && (currentState === 'listening' || currentState === 'picking-up')) {
    addDebugLog('🔄 Correcting state - microphone is not active but UI shows active state');
    updateState('idle');
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
  // Prevent rapid clicking
  if (clearLogBtnEl.disabled) return;
  clearLogBtnEl.disabled = true;
  
  // Clear the log content directly
  debugContentEl.textContent = '';
  logBuffer = [];
  
  // Clear any pending updates
  if (logUpdateInterval) {
    clearTimeout(logUpdateInterval);
    logUpdateInterval = null;
  }
  
  // Add the clear message directly without triggering update mechanism
  const timestamp = new Date().toLocaleTimeString();
  const clearMessage = `[${timestamp}] 🧹 Debug log cleared`;
  logBuffer.push(clearMessage);
  
  // Add some padding lines to maintain consistent width
  const paddedMessage = clearMessage + '\n\n\n\n\n';
  debugContentEl.textContent = paddedMessage;
  
  // Log to console
  console.log(clearMessage);
  
  // Re-enable button after a short delay
  setTimeout(() => {
    clearLogBtnEl.disabled = false;
  }, 500);
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

// Page scraping and analysis functions
async function scrapeCurrentPage() {
  addDebugLog('🔍 Scraping current page for links and content...');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabUrl = tab.url;
    
    if (!tabUrl || tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') || tabUrl.startsWith('moz-extension://') || tabUrl.startsWith('edge://')) {
      addDebugLog('🍂 Cannot scrape this page type - browser internal page');
      return;
    }
    
    addDebugLog(`🌐 Attempting to scrape page: ${tabUrl}`);
    
    // Check if page might have security restrictions
    if (tabUrl.startsWith('https://') && !tabUrl.includes('localhost')) {
      addDebugLog('🔒 HTTPS page detected - checking for security restrictions');
    } else if (tabUrl.startsWith('http://')) {
      addDebugLog('⚠️ HTTP page detected - may have mixed content issues');
    }

    // Check if content script is already loaded
    try {
      // Try to send a test message first
      const testResponse = await chrome.tabs.sendMessage(tab.id, {
        action: 'test'
      });
      addDebugLog('📄 Content script already loaded and responding');
    } catch (testError) {
      // Content script not loaded, try to inject it
      addDebugLog(`📄 Content script not responding, attempting injection. Error: ${testError.message}`);
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        addDebugLog('📄 Content script injected successfully');
        
        // Wait a bit longer after injection
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test again after injection
        try {
          const testResponse2 = await chrome.tabs.sendMessage(tab.id, {
            action: 'test'
          });
          addDebugLog('✅ Content script responding after injection');
        } catch (testError2) {
          addDebugLog(`🍂 Content script still not responding after injection: ${testError2.message}`);
    return;
  }
      } catch (injectError) {
        addDebugLog(`🍂 Content script injection failed: ${injectError.message}`);
    return;
      }
    }
    
    // Wait a moment for content script to initialize
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Send message to content script to scrape the page with timeout
    addDebugLog('📤 Sending scrapePage message to content script...');
    const response = await Promise.race([
      chrome.tabs.sendMessage(tab.id, {
        action: 'scrapePage'
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Content script timeout')), 5000)
      )
    ]);
    
    addDebugLog(`📥 Received response from content script: ${JSON.stringify(response)}`);
    
    if (response && response.success) {
      pageMap = {
        title: response.title,
        url: tabUrl,
        links: response.links,
        headings: response.headings,
        lastScraped: Date.now()
      };
      
      addDebugLog(`📄 Page scraped: "${pageMap.title}"`);
      addDebugLog(`🔗 Found ${pageMap.links.length} links and ${pageMap.headings.length} headings`);
      
      // Log some example links for debugging
      if (pageMap.links.length > 0) {
        const sampleLinks = pageMap.links.slice(0, 3).map(link => `"${link.text}" -> ${link.href}`);
        addDebugLog(`🔗 Sample links: ${sampleLinks.join(', ')}`);
      }
    } else {
      addDebugLog('🍂 Failed to scrape page - no response from content script');
    }
  } catch (error) {
    if (error.message.includes('Receiving end does not exist')) {
      addDebugLog('🍂 Content script not ready - will retry when needed');
      } else {
      addDebugLog(`🍂 Page scraping error: ${error.message}`);
    }
  }
}

// Handle link suggestions command
async function handleLinkSuggestionsCommand(command) {
  addDebugLog(`🔗 Handling link suggestions: "${command}"`);
  
  if (pageMap.links.length === 0) {
    speakResponse("I haven't found any links on this page yet. Let me analyze it first.");
    await scrapeCurrentPageWithRetry();
    if (pageMap.links.length === 0) {
      speakResponse("I still don't see any links on this page.");
      updateState('ready');
    return;
    }
  }
  
  // Extract what the user is looking for
  const searchTerm = command
    .replace(/what links|show links|available links|links for|find links/gi, '')
    .trim();
  
  if (!searchTerm) {
    // Show all links
    const linkTexts = pageMap.links.slice(0, 5).map(link => link.text).join(', ');
    speakResponse(`Here are the main links on this page: ${linkTexts}`);
  } else {
    // Find matching links
    const matchingLinks = findMatchingLinks(searchTerm);
    
    if (matchingLinks.length > 0) {
      const suggestions = matchingLinks.slice(0, 3).map(link => link.text).join(', ');
      speakResponse(`I found these links related to "${searchTerm}": ${suggestions}`);
    } else {
      speakResponse(`I couldn't find any links related to "${searchTerm}" on this page.`);
    }
  }
  
  updateState('ready');
}

// Handle page analysis command
async function handlePageAnalysisCommand(command) {
  addDebugLog(`📄 Handling page analysis: "${command}"`);
  
  if (pageMap.links.length === 0) {
    await scrapeCurrentPageWithRetry();
  }
  
  const analysis = generatePageAnalysis();
  speakResponse(analysis);
  updateState('ready');
}

// Scrape page with retry mechanism
async function scrapeCurrentPageWithRetry() {
  addDebugLog('🔍 Attempting to scrape page with retry...');
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    addDebugLog(`🔄 Scraping attempt ${attempt}/3`);
    await scrapeCurrentPage();
    
    if (pageMap.links.length > 0) {
      addDebugLog('✅ Page scraping successful');
    return;
  }
  
    if (attempt < 3) {
      addDebugLog('⏳ Waiting before retry...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  addDebugLog('🍂 Page scraping failed after 3 attempts');
}

// Find links that match a search term
function findMatchingLinks(searchTerm) {
  const term = searchTerm.toLowerCase();
  
  return pageMap.links.filter(link => {
    const text = link.text.toLowerCase();
    const href = link.href.toLowerCase();
    
    return text.includes(term) || 
           href.includes(term) ||
           text.split(' ').some(word => word.includes(term)) ||
           term.split(' ').some(word => text.includes(word));
  }).sort((a, b) => {
    // Prioritize exact matches and shorter, more relevant text
    const aScore = calculateRelevanceScore(a.text, term);
    const bScore = calculateRelevanceScore(b.text, term);
    return bScore - aScore;
  });
}

// Calculate relevance score for link matching
function calculateRelevanceScore(text, term) {
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  
  let score = 0;
  
  // Exact match gets highest score
  if (lowerText === lowerTerm) score += 100;
  
  // Starts with term gets high score
  if (lowerText.startsWith(lowerTerm)) score += 50;
  
  // Contains term gets medium score
  if (lowerText.includes(lowerTerm)) score += 25;
  
  // Word boundary matches get bonus
  const wordBoundaryRegex = new RegExp(`\\b${lowerTerm}\\b`, 'i');
  if (wordBoundaryRegex.test(lowerText)) score += 15;
  
  // Shorter text gets slight bonus (more concise)
  score += Math.max(0, 20 - text.length / 2);
  
  return score;
}

// Generate page analysis summary
function generatePageAnalysis() {
  const linkCount = pageMap.links.length;
  const headingCount = pageMap.headings.length;
  
  let analysis = `This page is titled "${pageMap.title}". `;
  
  if (linkCount > 0) {
    analysis += `I found ${linkCount} links on this page. `;
    
    // Categorize links
    const internalLinks = pageMap.links.filter(link => 
      link.href.startsWith('/') || link.href.includes(new URL(pageMap.url).hostname)
    ).length;
    
    const externalLinks = linkCount - internalLinks;
    
    if (internalLinks > 0) {
      analysis += `${internalLinks} are internal links to other parts of this site. `;
    }
    if (externalLinks > 0) {
      analysis += `${externalLinks} are external links to other websites. `;
    }
  }
  
  if (headingCount > 0) {
    analysis += `The page has ${headingCount} headings that organize the content. `;
  }
  
  // Suggest some key links
  if (linkCount > 0) {
    const keyLinks = pageMap.links
      .filter(link => link.text.length > 3 && link.text.length < 50)
      .slice(0, 3)
      .map(link => link.text);
    
    if (keyLinks.length > 0) {
      analysis += `Some key links include: ${keyLinks.join(', ')}. `;
    }
  }
  
  analysis += "You can ask me to find specific links or navigate to any of them.";
  
  return analysis;
}
