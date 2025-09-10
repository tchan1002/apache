# Sherpa 2 ("Apache") - Voice-First Assistant

A ubiquitous voice-first assistant that gives users a sense of continuous support while browsing. Sherpa should feel like it's always "right there," listening and ready to help with navigation and on-page guidance.

## Core Features

### Always Available
- Accessible within one click or hotword ("Hey Sherpa") at any time
- Minimal UI with a single, pulsating circle representing listening state
- Persistent voice listener with low-power wake-word detection

### Voice Commands

#### Navigation
- "Take me to [website]" - Navigate to a specific website
- "Go to [domain]" - Navigate to a domain
- "Navigate to [URL]" - Navigate to a specific URL

#### On-Page Assistance
- "Where is [element/text]" - Find and highlight elements on the current page
- "Find [text]" - Search for text content on the page
- "Show me [element]" - Locate specific page elements

#### General
- "Hey Sherpa" - Wake word to activate listening
- "Help" - Get assistance information
- Any other phrase - Fallback to Google search

### Visual Feedback
- **Idle**: Gray circle with "Click to activate"
- **Listening**: Red pulsing circle with "Listening..."
- **Processing**: Blue spinning circle with "Processing..."
- **Ready**: Green circle with "Ready to help"
- **Error**: Red triangle with "Error - Click to retry"

### Debug Logging
- **Real-time log**: Shows all voice interactions, commands, and system events
- **Toggle button**: Small circle in top-right corner to expand/collapse log
- **Drops down**: Log extends window height from 200px to 400px when expanded
- **Copy functionality**: Copy entire log to clipboard for debugging
- **Clear log**: Reset the log display
- **Performance optimized**: Shows last 80 lines with throttled updates
- **Rectangular design**: Fits comfortably in the 320x400px popup window

## Technical Implementation

### Voice Interface
- Browser Speech Recognition API for voice input
- Web Speech Synthesis API for voice output
- Wake-word detection ("Hey Sherpa")
- 10-second timeout for silence detection

### Navigation Control
- Programmatic control of browser tabs/URLs
- Smart URL construction (adds https:// if missing)
- Fallback to Google search for ambiguous queries

### On-Page Assistance
- DOM inspection to locate requested text or elements
- Visual highlighting of found elements
- Smooth scrolling to results
- Search across text content, form elements, links, and images

### Minimal UI
- Compact 320x200px popup window (rectangular)
- Pulsating circle with state transitions
- Debug log drops down to extend window height when expanded
- No complex UI elements beyond the listening indicator

## Installation

1. Load the extension in Chrome Developer Mode
2. Grant microphone permissions when prompted
3. Click the Sherpa circle to activate
4. Start using voice commands!

## Usage Examples

- "Hey Sherpa, take me to google.com"
- "Find the search button on this page"
- "Where is the login form?"
- "Go to github.com"
- "Show me the navigation menu"

## Browser Compatibility

- Chrome/Chromium-based browsers
- Requires microphone permissions
- Uses Web Speech APIs (not available in all browsers)

## Architecture

- **popup.html/js**: Minimal UI and voice interface
- **content.js**: On-page search and highlighting
- **background.js**: Extension lifecycle and message routing
- **permission.html/js**: Microphone permission handling

## Future Enhancements

- Context awareness across browsing sessions
- More sophisticated wake-word detection
- Custom voice commands
- Integration with more web services
- Accessibility improvements