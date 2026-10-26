# Ava Hermina Games

منصة ألعاب تفاعلية لخدمة مدارس الأحد.

**اللعبة الأولى:** عبقرينو

## التقنيات

- React + TypeScript + Vite
- Tailwind CSS
- Supabase (PostgreSQL + Auth + RLS)
- Cloudinary (للصور والصوت)
- Vercel (للنشر)

## التشغيل المحلي

```bash
# تثبيت الحزم
npm install

# نسخ متغيرات البيئة
cp .env.example .env.local
# ثم املأ قيم Supabase

# تشغيل خادم التطوير
npm run dev
```

## المبادئ الأساسية

1. **Supabase هو مصدر الحقيقة** — كل حالة الجولة تُحفظ في قاعدة البيانات.
2. **استعادة بعد Refresh** — الجولة تُستعاد بالكامل من خلال `sessionId`.
3. **منع تكرار النقاط** — عمليات النقاط تتم بشكل ذري.
4. **اللغة العربية و RTL** افتراضيًا.
5. **لا أسرار في المتصفح** — مفاتيح Cloudinary السرية لا تُستخدم في الواجهة.

## المستودع

https://github.com/shenuodaepraam63-lgtm/ava-hermina-games
