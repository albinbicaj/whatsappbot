const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// OpenAI Translation function
const translateText = async (text, targetLang) => {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a translation assistant.' },
                    { role: 'user', content: `Translate the following text to ${targetLang}: ${text}` },
                ],
            },
            {
                headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('Translation error:', error);
        return '❌ Translation failed.';
    }
};

// Webhook Verification (for Facebook to verify your webhook URL)
app.get('/webhook', (req, res) => {
    if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        // res.send('Invalid verification token');
        res.send(req.query['hub.challenge']);
    }
});

// Handle Incoming Messages
app.post('/webhook', async (req, res) => {
    const data = req.body;

    if (data.object === 'whatsapp_business_account') {
        const message = data.entry[0].changes[0].value.messages?.[0];

        if (message) {
            const from = message.from;
            const text = message.text.body;

            // Determine target language (here it's simplified to detect English and German)
            let targetLang = 'English';
            if (/[a-zA-Z]/.test(text)) {
                targetLang = 'German'; // Example: translate to German if English text is detected
            }

            // Translate and send message
            const translatedText = await translateText(text, targetLang);
            await sendMessage(from, translatedText);
        }

        return res.sendStatus(200);
    }
});

// Function to Send WhatsApp Messages
const sendMessage = async (to, message) => {
    try {
        await axios.post(
            `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: to,
                text: { body: message },
            },
            {
                headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
            }
        );
    } catch (error) {
        console.error('Error sending message:', error.response?.data || error.message);
    }
};

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
