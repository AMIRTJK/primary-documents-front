import express from 'express';
import { aiService, type IMessage } from '../services/ai.service.js';

const router = express.Router();

router.post('/generate', async (req, res) => {
    const { prompt, messages } = req.body;

    // Поддержка как одиночного промпта, так и массива сообщений (для истории)
    let chatMessages: IMessage[] = [];
    
    if (messages && Array.isArray(messages)) {
        chatMessages = messages;
    } else if (prompt) {
        chatMessages = [{ role: 'user', content: prompt }];
    } else {
        return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    // SSE заголовки
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const stream = await aiService.chatStream(chatMessages);

        for await (const part of stream) {
            res.write(`data: ${JSON.stringify({ content: part.message.content })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('Route Error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Ошибка ИИ. Проверьте, запущен ли Ollama.' })}\n\n`);
        res.end();
    }
});

export default router;