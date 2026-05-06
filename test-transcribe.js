require('dotenv').config();
const { transcribeVoiceNote } = require('./transcribe');
const fs = require('fs');

async function test() {
    // We create a mock message object that returns a valid small OGG buffer.
    const mockMsg = {
        downloadMedia: async () => {
            // A tiny valid base64 ogg or just an empty one to trigger ffmpeg error
            // Actually, let's just create a dummy "hello" text file and fake it as ogg. No, ffmpeg will fail.
            // Let's provide a real base64 of a 1-second silent ogg.
            const silentOggB64 = "T2dnUwACAAAAAAAAAACuXwAAAAAAANP+A3IBHgF2b3JiaXMAAAAAAkQgAACaAAAAgQAAAAAAAQO+AAAAAAAAgQAAAAB2b3JiaXMuBXZvcmJpcwAAAAEAAACbAAAAAAAAT2dnUwAAAAAAAAAAAACuXwEAAAAAAADG6nABHgF2b3JiaXMtAAAAAQAAAGVuY29kZXI9TGGF2b3JiaXMBAAAEbGlidm9yYmlzvgMAAAB2b3JiaXMjAAAAAQAAAHZvcmJpczQAAAABAQAAVm9yYmlzvgAA";
            return { data: silentOggB64 };
        }
    };

    console.log("Starting test transcription...");
    try {
        const text = await transcribeVoiceNote(mockMsg);
        console.log("Result:", text);
    } catch (e) {
        console.error("Caught error:", e);
    }
}

test();
