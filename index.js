require('dotenv').config();
const { Client, LocalAuth, MessageTypes } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const { OWNER_NUMBER, ALLOWED_CONTACTS } = require('./config');
const { scheduleReply, cancelTimer, hasTimer, activateAgent, deactivateAgent, isAgentActive } = require('./timer');
const { generateSecretaryReply, generateActiveReply, shouldReply } = require('./agent');
const { transcribeVoiceNote } = require('./transcribe');
const { saveMessage } = require('./db');

// Set up tracking for messages sent by the bot to distinguish them from owner's messages
const recentBotReplies = new Map();

function trackBotReply(contactId, text) {
    if (!recentBotReplies.has(contactId)) {
        recentBotReplies.set(contactId, new Set());
    }
    const set = recentBotReplies.get(contactId);
    set.add(text);
    setTimeout(() => {
        set.delete(text);
    }, 10000); // clear after 10s
}

function isBotReply(contactId, text) {
    const set = recentBotReplies.get(contactId);
    if (!set) return false;
    if (set.has(text)) {
        set.delete(text);
        return true;
    }
    return false;
}

// ─── WhatsApp Client ──────────────────────────────────────────────────────────

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: process.env.SESSION_PATH || './sessions',
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

// ─── Auth & Ready Events ──────────────────────────────────────────────────────

client.on('qr', (qr) => {
    console.log('\n[auth] Scan the QR code below with WhatsApp:\n');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('[auth] Authenticated successfully');
});

client.on('auth_failure', (msg) => {
    console.error('[auth] Authentication failed:', msg);
});

client.on('ready', () => {
    console.log('\n[ready] WhatsApp AI Secretary is running');
    console.log(`[ready] Owner: ${OWNER_NUMBER}`);
    console.log(`[ready] Monitoring ${ALLOWED_CONTACTS.length} contact(s)\n`);
});

client.on('disconnected', (reason) => {
    console.warn('[disconnected]', reason);
});

// ─── Incoming Message Handler ─────────────────────────────────────────────────

client.on('message', async (msg) => {
    const contactId = msg.from;

    // Ignore groups and own messages
    if (contactId.endsWith('@g.us')) return;
    if (msg.fromMe) return;

    console.log(`\n[msg] From: ${contactId} | Type: ${msg.type}`);

    // ── Image / Sticker → instant acknowledgement, always ────────────────────
    if (msg.type === MessageTypes.IMAGE || msg.type === MessageTypes.STICKER) {
        if (!ALLOWED_CONTACTS.includes(contactId)) return;
        const ack = "Got your image, will check shortly!";
        await saveMessage(contactId, 'user', '[image]');
        trackBotReply(contactId, ack);
        await client.sendMessage(contactId, ack);
        await saveMessage(contactId, 'assistant', ack);
        return;
    }

    // ── Voice note → transcribe ───────────────────────────────────────────────
    let messageText = msg.body || '';
    if (msg.type === MessageTypes.AUDIO || msg.type === MessageTypes.VOICE) {
        if (!ALLOWED_CONTACTS.includes(contactId)) return;
        console.log('[msg] Voice note — transcribing...');
        messageText = await transcribeVoiceNote(msg);
        if (!messageText) {
            console.warn('[msg] Transcription empty — skipping');
            return;
        }
        console.log(`[msg] Transcribed: "${messageText}"`);
    }

    // Allowlist + empty check
    if (!ALLOWED_CONTACTS.includes(contactId)) return;
    if (!messageText) return;

    // ── Save incoming message to DB immediately ───────────────────────────────
    await saveMessage(contactId, 'user', messageText);

    // ── PHASE 2: Agent is active — reply immediately, no timer ───────────────
    if (isAgentActive(contactId)) {
        console.log(`[msg] Agent active for ${contactId} — checking if reply needed...`);

        const needsReply = await shouldReply(messageText);
        if (!needsReply) {
            console.log(`[msg] No reply needed — conversation-ender detected`);
            return;
        }

        try {
            const reply = await generateActiveReply(contactId);
            trackBotReply(contactId, reply);
            await client.sendMessage(contactId, reply);
        } catch (err) {
            console.error('[active] Failed to send reply:', err.message);
        }
        return;
    }

    // ── PHASE 1: Waiting — schedule/reset 1-min timer ────────────────────────
    scheduleReply(contactId, async (cId, wasBusy) => {
        console.log(`\n[timer] Fired for ${cId} — generating initial reply...`);
        try {
            const reply = await generateSecretaryReply(cId, wasBusy);
            trackBotReply(cId, reply);
            await client.sendMessage(cId, reply);
            // Activate agent — all future messages get immediate replies
            activateAgent(cId);
        } catch (err) {
            console.error('[timer] Failed to send reply:', err.message);
        }
    });
});

// ─── Owner Reply Detection ────────────────────────────────────────────────────

client.on('message_create', async (msg) => {
    if (!msg.fromMe) return;

    const contactId = msg.to;
    if (contactId.endsWith('@g.us')) return;

    const body = msg.body || '';

    // Ignore this event if the message was sent by the bot programmatically
    if (isBotReply(contactId, body)) {
        return;
    }

    // Cancel waiting timer if one exists
    if (hasTimer(contactId)) {
        cancelTimer(contactId);
    }

    // Deactivate agent if it was in active mode
    if (isAgentActive(contactId)) {
        deactivateAgent(contactId);
    }

    // Save owner's reply to history
    if (body) {
        await saveMessage(contactId, 'assistant', body);
        console.log(`[owner] Reply saved for ${contactId}: "${body}"`);
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────

console.log('[init] Starting WhatsApp AI Secretary...');
client.initialize();
