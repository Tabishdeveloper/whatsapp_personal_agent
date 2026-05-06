require('dotenv').config();
const OpenAI = require('openai');
const { getHistory, saveMessage } = require('./db');
const { markBusyReplySent } = require('./timer');
const { CONTEXT_CHECK_LIMIT } = require('./config');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── System Prompts ───────────────────────────────────────────────────────────

// Used when timer fires and no prior context exists
const PROMPT_INITIAL_BUSY = `You are Tabish. Reply to this WhatsApp message as him — in first person.

Rules:
- 1 short sentence, max 12 words. No filler.
- Sound like a real person dashing off a quick reply between tasks.
- Match the language (English, Urdu, Roman Urdu).
- Tone: warm but brief. Think "tied up, will get back to you" energy.
- No greetings, no sign-off, no "I'll have Tabish..." — YOU are Tabish.`;

// Used when timer fires and message relates to prior chat history
const PROMPT_INITIAL_CONTEXT = `You are Tabish. Reply to this WhatsApp message as him — in first person.
The conversation history is provided for context.

Rules:
- Max 2 sentences. Be direct.
- Match the language (English, Urdu, Roman Urdu).
- Use the chat history to give a specific, relevant reply — reference what was discussed.
- Sound like Tabish picking up his phone and quickly responding.
- No greetings, no sign-off, no "I'll have Tabish..." — YOU are Tabish.`;

// Used when agent is in active mode — keeps the conversation going naturally
const PROMPT_ACTIVE_CHAT = `You are Tabish. Reply to this WhatsApp message as him — in first person.
You have the full conversation history.

Rules:
- Max 2 sentences. Conversational, warm.
- Match the language (English, Urdu, Roman Urdu).
- Use the full history — give informed, contextual replies.
- If asked something only Tabish would know: "Let me check and come back to you."
- If a decision or action is needed: "I'll look into it and get back to you."
- No greetings, no sign-off — just reply like you're mid-conversation.
- YOU are Tabish. First person always.`;

// ─── Should Reply Check ───────────────────────────────────────────────────────

async function shouldReply(newMessage) {
    const prompt = `Does this WhatsApp message need a reply, or is it a conversation-ender?

Message: "${newMessage}"

NO (conversation-ender): "ok", "okay", "thanks", "thank you", "noted", "👍", 
"alright", "sure", "got it", "fine", "hm", "hmm", single emoji, 
one-word acknowledgements with no question or new information.

YES (needs a reply): questions, new information, requests, greetings, 
anything expecting a response.

Reply with only YES or NO.`;;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 10,
            messages: [{ role: 'user', content: prompt }],
        });
        const answer = response.choices[0].message.content.trim().toUpperCase();
        console.log(`[agent] shouldReply → ${answer} | "${newMessage}"`);
        return answer === 'YES';
    } catch (err) {
        console.error('[agent] shouldReply error:', err.message);
        return true; // default: reply if unsure
    }
}

// ─── Context Check (Haiku) ────────────────────────────────────────────────────

/**
 * Check if the new message relates to prior chat history.
 * Passes history EXCLUDING the latest message (which is the new message itself).
 */
async function hasContextMatch(history, newMessage) {
    // Need at least some prior history to compare against
    const priorHistory = history.slice(0, -1);
    if (!priorHistory.length) return false;

    const recent = priorHistory.slice(-CONTEXT_CHECK_LIMIT);
    const historyText = recent
        .map(m => `${m.role === 'user' ? 'Them' : 'Tabish'}: ${m.content}`)
        .join('\n');

    const prompt = `Chat history:\n${historyText}\n\nNew message: "${newMessage}"\n\nDoes the new message relate to the existing chat history? Reply with only YES or NO.`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 10,
            messages: [{ role: 'user', content: prompt }],
        });
        const answer = response.choices[0].message.content.trim().toUpperCase();
        console.log(`[agent] contextMatch → ${answer}`);
        return answer === 'YES';
    } catch (err) {
        console.error('[agent] contextMatch error:', err.message);
        return false;
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Merge consecutive same-role messages and ensure history is clean.
 * Also ensures the first message is from 'user'.
 */
function prepareMessages(history) {
    if (!history.length) return [];

    const merged = [];
    for (const msg of history) {
        if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
            merged[merged.length - 1].content += '\n' + msg.content;
        } else {
            merged.push({ role: msg.role, content: msg.content });
        }
    }

    // OpenAI requires first message to be 'user'
    while (merged.length && merged[0].role !== 'user') {
        merged.shift();
    }

    return merged;
}

/**
 * Call GPT-4o with a system prompt and history.
 */
async function generateReply(systemPrompt, history) {
    const messages = prepareMessages(history);
    if (!messages.length) {
        throw new Error('No valid messages to send to OpenAI');
    }

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 150,
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
        ],
    });

    return response.choices[0].message.content.trim();
}

// ─── Initial Reply (timer-fired) ──────────────────────────────────────────────

/**
 * Called when the 1-minute timer fires.
 * Decides between busy reply and context-aware reply.
 * User message is already saved in DB — history includes it.
 */
async function generateSecretaryReply(contactId, wasBusy) {
    console.log(`[agent] Generating initial reply for ${contactId}`);
    const history = await getHistory(contactId);

    if (!history.length) {
        const fallback = "I'll get back to you as soon as possible";
        await saveMessage(contactId, 'assistant', fallback);
        return fallback;
    }

    const lastUserMsg = [...history].reverse().find(m => m.role === 'user')?.content || '';

    let systemPrompt;
    let replyType;

    if (wasBusy) {
        systemPrompt = PROMPT_INITIAL_BUSY;
        replyType = 'busy-followup';
    } else {
        const contextMatch = await hasContextMatch(history, lastUserMsg);
        if (contextMatch) {
            systemPrompt = PROMPT_INITIAL_CONTEXT;
            replyType = 'context-match';
        } else {
            systemPrompt = PROMPT_INITIAL_BUSY;
            replyType = 'no-context-busy';
            markBusyReplySent(contactId);
        }
    }

    console.log(`[agent] Reply type: ${replyType}`);

    try {
        const reply = await generateReply(systemPrompt, history);
        await saveMessage(contactId, 'assistant', reply);
        console.log(`[agent] Sent: "${reply}"`);
        return reply;
    } catch (err) {
        console.error('[agent] generateSecretaryReply error:', err.message);
        const fallback = "Sorry, will get back to you shortly!";
        await saveMessage(contactId, 'assistant', fallback);
        return fallback;
    }
}

// ─── Active Conversation Reply ────────────────────────────────────────────────

/**
 * Called when agent is in active mode — replies immediately to every message.
 * User message is already saved in DB — history includes it.
 */
async function generateActiveReply(contactId) {
    console.log(`[agent] Generating active reply for ${contactId}`);
    const history = await getHistory(contactId);
  
    try {
        const reply = await generateReply(PROMPT_ACTIVE_CHAT, history);
        await saveMessage(contactId, 'assistant', reply);

        // Simulate human typing delay (4–7 seconds)
        const delay = Math.floor(Math.random() * (7000 - 4000 + 1)) + 4000;
        console.log(`[agent] Waiting ${(delay / 1000).toFixed(1)}s before sending (human delay)...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        console.log(`[agent] Active reply: "${reply}"`);
        return reply;
    } catch (err) {
        console.error('[agent] generateActiveReply error:', err.message);
        const fallback = "Will pass that along shortly!";
        await saveMessage(contactId, 'assistant', fallback);
        return fallback;
    }
}

module.exports = { generateSecretaryReply, generateActiveReply, shouldReply };
