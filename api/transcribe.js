export default async function handler(req, res) {
    // เปิดระบบ CORS ให้หน้าเว็บยิงเข้ามาคุยได้
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // ดึง API Key ที่แอบซ่อนไว้ใน Vercel
        const apiKey = process.env.GROQ_API_KEY;
        const n8nUrl = "https://n8n.scmc.cmu.ac.th/webhook/mac-agent";

        if (!apiKey) {
            return res.status(500).json({ error: 'Missing GROQ_API_KEY in Vercel configuration' });
        }

        // อ่านก้อนข้อมูล Form Data (ไฟล์เสียง) ที่ส่งมาจากหน้าบ้าน
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // ดึงขอบเขตม่านความปลอดภัย (Boundary) เพื่อส่งต่อให้ Groq
        const contentType = req.headers['content-type'];

        // 1. ส่งไฟล์เสียงคุยกับ Groq Whisper หลังบ้าน (ปลอดภัย คีย์ไม่หลุด)
        const groqResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": contentType
            },
            body: buffer
        });

        const whisperData = await groqResponse.json();
        const userText = whisperData.text;

        if (!userText) {
            return res.status(400).json({ error: 'Could not transcribe audio' });
        }

        // 2. ส่งข้อความยาวๆ พุ่งตรงเข้า n8n มหาลัยทันที
        const n8nResponse = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appName: userText.trim() })
        });

        return res.status(200).json({ success: true, text: userText });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
