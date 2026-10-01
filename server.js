const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware لتحليل طلبات الـ JSON
app.use(express.json());

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/**
 * دالة مساعدة لإعادة المحاولة تلقائياً باستخدام Exponential Backoff
 * @param {Function} fn - الدالة التي تريد تنفيذها (إرسال الطلب)
 * @param {number} retries - عدد محاولات الإعادة القصوى
 * @param {number} delay - التأخير الأولي بالمللي ثانية
 */
async function retryWithBackoff(fn, retries = 3, delay = 1000) {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) {
            throw error; // نفذت المحاولات، يتم رمي الخطأ للتعامل معه خارجاً
        }
        
        console.warn(`⚠️ فشل الاتصال، سيتم إعادة المحاولة خلال ${delay / 1000} ثوانٍ... الخطأ: ${error.message}`);
        
        // الانتظار للفترة الزمنية المحددة
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // مضاعفة وقت الانتظار للمحاولة القادمة (Exponential Backoff) مع إضافة عامل عشوائي بسيط لتجنب التزامن
        const nextDelay = delay * 2;
        return retryWithBackoff(fn, retries - 1, nextDelay);
    }
}

app.post('/api/telemetry', async (req, res) => {
    try {
        const report = req.body;

        if (!report || Object.keys(report).length === 0) {
            return res.status(400).json({ error: 'Payload is empty or invalid JSON.' });
        }

        const { status = 'INFO', contactsCount, timestamp } = report;
        const embedColor = status.toUpperCase() === 'ERROR' ? 15158332 : 3066993;

        const discordPayload = {
            embeds: [
                {
                    title: `📊 تقرير تشخيص ومزامنة جديد (${status.toUpperCase()})`,
                    color: embedColor,
                    fields: [
                        {
                            name: '👥 عدد جهات الاتصال',
                            value: contactsCount !== undefined ? `${contactsCount}` : 'غير متوفر',
                            inline: true
                        },
                        {
                            name: '⏰ الوقت',
                            value: timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString(),
                            inline: true
                        },
                        {
                            name: '📝 التفاصيل',
                            value: `\`\`\`json\n${JSON.stringify(report, null, 2)}\`\`\``,
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Render Microservice Telemetry Bot (With Retry)'
                    }
                }
            ]
        };

        if (DISCORD_WEBHOOK_URL) {
            // تنفيذ الإرسال مع تفعيل آلية إعادة المحاولة (3 محاولات بانتظار تصاعدي: 1ث، 2ث، 4ث)
            await retryWithBackoff(
                () => axios.post(DISCORD_WEBHOOK_URL, discordPayload),
                3,
                1000
            );
        } else {
            console.warn('DISCORD_WEBHOOK_URL is not set in environment variables.');
        }

        return res.status(200).json({ success: true, message: 'Telemetry report processed and forwarded successfully.' });

    } `catch` (error) {
        console.error('❌ فشل إرسال التقرير إلى ديسكورد بعد استنفاد محاولات الإعادة:', error.message);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal Server Error while processing telemetry after retries.',
            details: error.message 
        });
    }
});

// نقطة فحص الحالة (Health Check)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'telemetry-webhook-service' });
});

app.listen(PORT, () => {
    console.log(`Telemetry microservice is running on port ${PORT}`);
});
