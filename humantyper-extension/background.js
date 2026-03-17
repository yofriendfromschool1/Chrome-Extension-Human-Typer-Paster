/**
 * HumanTyper — Background Service Worker
 * Bridges popup ↔ content script communication.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Forward progress/done/error from content script to popup
  if (msg.action === 'typing-progress' || msg.action === 'typing-done' || msg.action === 'typing-error') {
    // Broadcast to all extension pages (popup)
    chrome.runtime.sendMessage(msg).catch(() => {
      // Popup might be closed, that's fine
    });
    return false;
  }
  return false;
});

// Handle install — open welcome or set defaults
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    config: {
      delay: 5.0,
      wpm: 65,
      errorRate: 0.03,
      burstEnabled: true,
      burstWords: 8,
      burstPauseMin: 2.0,
      burstPauseMax: 5.0,
      substituteEnabled: true,
      substituteRate: 0.03,
      substituteComplexity: 'moderate',
      fatigueRate: 0.10,
      paragraphPauseMin: 2.0,
      paragraphPauseMax: 8.0,
      hesitationEnabled: true,
      rereadingEnabled: true,
      rereadingPauseMin: 0.5,
      rereadingPauseMax: 2.0,
    },
  });
});
