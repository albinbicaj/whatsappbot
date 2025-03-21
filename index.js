// Import the dotenv package
require('dotenv').config(); 

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');
const langdetect = require('langdetect');

const app = express();
const port = 3000;

// Set up OpenAI API
const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY,  // Use OpenAI API key from the .env file
}));

// Set up WhatsApp Business API credentials from the .env file
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// Middleware to parse incoming JSON requests
app.use(bodyParser.json());

// Function to detect the language of the incoming message
function detectLanguage(text) {
    return langdetect.detect(text);
}

// Function to translate the text using OpenAI GPT
async function translateText(text, targetLanguage) {
    const prompt = `Translate this text to ${targetLanguage}: ${text}`;
    const response = await openai.createCompletion({
        model: "gpt-4",  // You can use GPT-3.5 or GPT-4 depending on your preference
        prompt: prompt,
        max_tokens: 200,
        temperature: 0.3
    });

    return response.data.choices[0].text.trim();
}

// Function to send a message back to WhatsApp
async function sendWhatsappMessage(to, message) {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: to,
                text: { body: message },
            },
            {
                params: {
                    access_token: ACCESS_TOKEN,
                },
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Webhook to handle incoming WhatsApp messages
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body;

        // Extract incoming message and sender number
        const incomingMessage = data.entry[0].changes[0].value.messages[0].text.body;
        const senderNumber = data.entry[0].changes[0].value.messages[0].from;

        // Detect the language of the incoming message
        const detectedLanguage = detectLanguage(incomingMessage);

        let translatedMessage;
        if (detectedLanguage === 'de') {  // If message is in German, translate to Chinese
            translatedMessage = await translateText(incomingMessage, 'Chinese');
        } else if (detectedLanguage === 'zh') {  // If message is in Chinese, translate to German
            translatedMessage = await translateText(incomingMessage, 'German');
        } else {
            translatedMessage = "I can only translate between German and Chinese.";
        }

        // Send the translated message back to the sender
        await sendWhatsappMessage(senderNumber, translatedMessage);

        // Respond with a success message
        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});

// Webhook verification (Facebook will send this when you first set up the webhook)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === process.env.VERIFICATION_TOKEN) {  // Use the verification token from the .env file
        res.status(200).send(challenge);
    } else {
        res.status(403).send('Verification failed');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
