# استخدام صورة Node.js خفيفة الوزن
FROM node:20-alpine

# تحديد مجلد العمل داخل الحاوية
WORKDIR /app

# نسخ ملفات الاعتماديات أولاً لاستغلال ميزة التخزين المؤقت (Caching)
COPY package*.json ./

# تثبيت الحزم الإنتاجية فقط
RUN npm ci --only=production

# نسخ باقي ملفات المشروع
COPY . .

# المنفذ الذي تعمل عليه الخدمة
EXPOSE 3000

# أمر تشغيل التطبيق
CMD ["npm", "start"]
