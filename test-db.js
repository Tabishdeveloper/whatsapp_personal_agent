require('dotenv').config();
const { getHistory, saveMessage } = require('./db');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

async function check() {
    console.log("Checking DB Connection...");
    
    // Check if table exists / fetch a few records
    const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .limit(5);

    if (error) {
        console.error("Error fetching data:", error.message);
    } else {
        console.log(`Found ${data.length} records in chat_history table.`);
        console.log(data);
    }
}

check();
