// ============================================================
// config.js — Edit these two values before running the agent
// ============================================================

// Your WhatsApp number in the format: countrycode+number@c.us
// No +, no spaces, no dashes. Example: '923001234567@c.us'
const OWNER_NUMBER = '92123456789@c.us'; // owner whatsapp number 

// WhatsApp IDs of contacts the agent will respond to.
// To find a contact's ID: check the console log of msg.from when they message you.
const ALLOWED_CONTACTS = [
    '92123456789@c.us',  // Jhon Doe
];

// How many minutes to wait before the agent fires a reply
const REPLY_DELAY_MINUTES = 1;

// How many past messages to load for context
const HISTORY_LIMIT = 20;

// How many recent messages to use for the context classification check
const CONTEXT_CHECK_LIMIT = 10;

module.exports = {
    OWNER_NUMBER,
    ALLOWED_CONTACTS,
    REPLY_DELAY_MINUTES,
    HISTORY_LIMIT,
    CONTEXT_CHECK_LIMIT,
};
