// ============================================================
// config.js — Edit these two values before running the agent
// ============================================================

// Your WhatsApp number in the format: countrycode+number@c.us
// No +, no spaces, no dashes. Example: '923001234567@c.us'
const OWNER_NUMBER = '923287599043@c.us';

// WhatsApp IDs of contacts the agent will respond to.
// To find a contact's ID: check the console log of msg.from when they message you.
const ALLOWED_CONTACTS = [
    '923356641733@c.us',  // Abdul Haadi
    '923120012250@c.us',  // Abdul Waheed
    '923088348534@c.us',  // Danish Almas
    '923229377233@c.us',  // Kamran
    '923145494473@c.us',  // Aiza Ejaz
    '923129851916@c.us',  // Biba
    '923046397004@c.us',  // Januu
    '923016550799@c.us',  // Manan Sharif
    '923468558793@c.us',  // Musharaf
    '258660278255728@lid', // Fazeel
    '923139515072@c.us',  // Hamid Iplex
    '923145377862@c.us',
    '101009258975328@lid',// Rehan
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
