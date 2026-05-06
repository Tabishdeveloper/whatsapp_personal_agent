const { REPLY_DELAY_MINUTES } = require('./config');

// Map of contactId -> { timer, busyReplySent }
const timers = new Map();

// Set of contactIds where agent has taken over and is actively chatting
const activeContacts = new Set();

const DELAY_MS = REPLY_DELAY_MINUTES * 60 * 1000;

/**
 * Schedule an auto-reply for a contact.
 * Resets the timer if one already exists (new message bumps the clock).
 */
function scheduleReply(contactId, callback) {
    if (timers.has(contactId)) {
        clearTimeout(timers.get(contactId).timer);
    }

    const existing = timers.get(contactId) || { busyReplySent: false };

    const timer = setTimeout(() => {
        const state = timers.get(contactId);
        const wasBusy = state ? state.busyReplySent : false;
        timers.delete(contactId);
        callback(contactId, wasBusy);
    }, DELAY_MS);

    timers.set(contactId, { timer, busyReplySent: existing.busyReplySent });
    console.log(`[timer] Scheduled reply for ${contactId} in ${REPLY_DELAY_MINUTES} min`);
}

/**
 * Cancel the pending timer (owner replied manually).
 */
function cancelTimer(contactId) {
    if (timers.has(contactId)) {
        clearTimeout(timers.get(contactId).timer);
        timers.delete(contactId);
        console.log(`[timer] Cancelled timer for ${contactId} — owner replied`);
    }
}

function markBusyReplySent(contactId) {
    const existing = timers.get(contactId) || { timer: null, busyReplySent: false };
    timers.set(contactId, { ...existing, busyReplySent: true });
}

function hasTimer(contactId) {
    return timers.has(contactId);
}

/**
 * Mark agent as active for a contact — agent will now reply immediately
 * to every incoming message without waiting for a timer.
 */
function activateAgent(contactId) {
    activeContacts.add(contactId);
    console.log(`[agent] Active mode ON for ${contactId}`);
}

/**
 * Deactivate agent — owner has taken back the conversation.
 */
function deactivateAgent(contactId) {
    if (activeContacts.has(contactId)) {
        activeContacts.delete(contactId);
        console.log(`[agent] Active mode OFF for ${contactId} — owner is back`);
    }
}

/**
 * Is the agent currently in active chat mode for this contact?
 */
function isAgentActive(contactId) {
    return activeContacts.has(contactId);
}

module.exports = {
    scheduleReply,
    cancelTimer,
    markBusyReplySent,
    hasTimer,
    activateAgent,
    deactivateAgent,
    isAgentActive,
};
