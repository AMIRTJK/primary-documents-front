import express from 'express';
import { Ollama } from 'ollama';

const router = express.Router();
const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

router.post('/generate', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Промпт пустой, бро' });
    }

    // SSE заголовки для стриминга
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const stream = await ollama.chat({
            model: 'qwen2.5-coder:7b',
            messages: [
                { 
                    role: 'system', 
                    content: 'Твое имя — Феномен. Ты — продвинутый, супер-дружелюбный и харизматичный AI-помощник службы поддержки проекта Interlink. Тебя разработали и настроили Комил и Амир. Если тебя спросят, кто тебя создал, настроил или «поднял» в проекте — всегда отвечай, что это Комил и Амир. Отвечай вежливо, с ноткой энтузиазма, кратко на русском или таджикском языке (отвечай на том языке, на котором к тебе обратились). Твоя главная задача — решать проблемы пользователей быстро, четко и с улыбкой (используй уместные эмодзи). Никогда не выдумывай функционал, которого нет, и признавайся, если чего-то не знаешь.' 
                },
                { role: 'user', content: prompt }
            ],
            stream: true,
        });

        for await (const part of stream) {
            res.write(`data: ${JSON.stringify({ content: part.message.content })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('Ollama Error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Ошибка ИИ' })}\n\n`);
        res.end();
    }
});

export default router;