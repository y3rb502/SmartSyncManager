const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware لتحليل طلبات الـ JSON
app.use(express.json());

// رابط الـ Discord Webhook يتم جلبه من متغيرات البيئة لضمان الأمان
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

app.post('/api/telemetry', async (req, res) => {
    try {
        const report = req.body;

        // التحقق من وجود بيانات أساسية في الطلب
        if (!report || Object.keys(report).length === 0) {
            return res.status(400).json({ error: 'Payload is empty or invalid JSON.' });
        }

        // استخراج البيانات (مثل عدد جهات الاتصال، الحالة، أو أي ملاحظات تشخيصية)
        const { status = 'INFO', contactsCount, message, timestamp } = report;

        // تحديد لون الشريط الجانبي في رسالة ديسكورد حسب الحالة (أخضر للنجاح، أحمر للأخطاء)
        const embedColor = status.toUpperCase() === 'ERROR' ? 15158332 : 3066993;

        // صياغة الرسالة بشكل مرتب ومنظم لتظهر باحترافية في قناة الـ DevOps
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
                        text: 'Render Microservice Telemetry Bot'
                    }
                }
            ]
        };

        if (DISCORD_WEBHOOK_URL) {
            // إرسال التقرير إلى ديسكورد
            await axios.post(DISCORD_WEBHOOK_URL, discordPayload);
        } else {
            console.warn('DISCORD_WEBHOOK_URL is not set in environment variables.');
        }

        return res.status(200).json({ success: true, message: 'Telemetry report processed and forwarded successfully.' });

    } catch (error) {
        console.error('Error forwarding telemetry to Discord:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error while processing telemetry.' });
    }
});

// نقطة فحص الحالة (Health Check) لتأكد منصة Render أن الخدمة تعمل
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'telemetry-webhook-service' });
});

app.listen(PORT, () => {
    console.log(`Telemetry microservice is running on port ${PORT}`);
});
