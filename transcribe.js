require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Transcribe a WhatsApp voice note to text using OpenAI Whisper.
 *
 * WhatsApp delivers voice notes as .ogg (Opus codec).
 * Whisper works best with .mp3, so we convert via ffmpeg first.
 *
 * @param {import('whatsapp-web.js').Message} msg - The WhatsApp voice note message
 * @returns {Promise<string>} Transcribed text, or empty string on failure
 */
async function transcribeVoiceNote(msg) {
    const tmpDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const oggPath = path.join(tmpDir, `voice_${Date.now()}.ogg`);
    const mp3Path = oggPath.replace('.ogg', '.mp3');

    try {
        // Download the media from WhatsApp
        const media = await msg.downloadMedia();
        if (!media || !media.data) {
            console.error('[transcribe] Failed to download voice note media');
            return '';
        }

        // Write the raw ogg buffer to disk
        const buffer = Buffer.from(media.data, 'base64');
        fs.writeFileSync(oggPath, buffer);

        // Convert ogg → mp3 using ffmpeg
        execSync(`ffmpeg -y -i "${oggPath}" "${mp3Path}"`, { stdio: 'pipe' });

        // Send to Whisper
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(mp3Path),
            model: 'whisper-1',
        });

        console.log(`[transcribe] Transcribed voice note: "${transcription.text}"`);
        return transcription.text || '';

    } catch (err) {
        console.error('[transcribe] Error:', err.message);
        return '';
    } finally {
        // Clean up temp files
        if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
        if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
    }
}

module.exports = { transcribeVoiceNote };
