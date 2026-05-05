import express from 'express';
import { aiService, type IMessage } from '../services/ai.service.js';

const router = express.Router();

/**
 * Основной роут генерации ответа (с поддержкой инструментов)
 */
router.post('/generate', async (req, res) => {
    const { prompt, messages, currentPath } = req.body;

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
        const stream = await aiService.chatStream(chatMessages, currentPath);

        let fullContent = '';
        let toolCalls: any[] = [];
        let isFirstChunk = true;

        for await (const part of stream) {
            // Если есть вызов инструмента, сохраняем его и ПРЕРЫВАЕМ стрим текста
            if (part.message.tool_calls && part.message.tool_calls.length > 0) {
                toolCalls = part.message.tool_calls;
                break;
            }

            if (part.message.content) {
                // Если это первый чанк и он похож на начало JSON, притормозим (некоторые модели так тупят)
                const content = part.message.content;
                if (isFirstChunk && content.trim().startsWith('{')) {
                    fullContent += content;
                    isFirstChunk = false;
                    continue; 
                }

                fullContent += content;
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
                isFirstChunk = false;
            }
        }

        // Если были вызовы инструментов
        if (toolCalls.length > 0) {
            const updatedMessages = [...chatMessages, { role: 'assistant', content: fullContent, tool_calls: toolCalls }];
            
            for (const toolCall of toolCalls) {
                const result = await aiService.executeTool(toolCall.function.name, toolCall.function.arguments);
                updatedMessages.push({
                    role: 'tool',
                    content: JSON.stringify(result)
                });
            }

            // Запускаем новый поток с результатами
            const finalStream = await aiService.chatStream(updatedMessages, currentPath);
            for await (const finalPart of finalStream) {
                if (finalPart.message.content) {
                    res.write(`data: ${JSON.stringify({ content: finalPart.message.content })}\n\n`);
                }
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('Route Error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Ошибка ИИ. Проверьте соединение с Ollama.' })}\n\n`);
        res.end();
    }
});

/**
 * Роут для сбора обратной связи
 */
router.post('/feedback', async (req, res) => {
    const { messageId, type, comment } = req.body;
    
    try {
        const { getDb } = await import('../db/index.js');
        const db = getDb();
        
        await db.run(
            'INSERT INTO ai_feedback (messageId, type, comment) VALUES (?, ?, ?)',
            [messageId, type, comment || null]
        );

        console.log(`[Feedback Saved] Message ${messageId}: ${type === 'up' ? '👍' : '👎'}`);
        res.json({ success: true, message: 'Спасибо за отзыв!' });
    } catch (error) {
        console.error('Feedback save error:', error);
        res.status(500).json({ error: 'Ошибка при сохранении отзыва' });
    }
});

export default router;
