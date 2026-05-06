require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { HISTORY_LIMIT } = require('./config');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

/**
 * Save a message (user or assistant) to chat history.
 * @param {string} contactId  - WhatsApp contact ID e.g. '923001234567@c.us'
 * @param {'user'|'assistant'} role
 * @param {string} content
 */
async function saveMessage(contactId, role, content) {
    const { error } = await supabase
        .from('chat_history')
        .insert({ contact_id: contactId, role, content });

    if (error) {
        console.error('[db] saveMessage error:', error.message);
    }
}

/**
 * Fetch the last N messages for a contact, oldest first.
 * @param {string} contactId
 * @param {number} [limit]
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
async function getHistory(contactId, limit = HISTORY_LIMIT) {
    const { data, error } = await supabase
        .from('chat_history')
        .select('role, content')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[db] getHistory error:', error.message);
        return [];
    }

    // Reverse so oldest is first (correct chronological order for AI context)
    return (data || []).reverse();
}

module.exports = { saveMessage, getHistory };
