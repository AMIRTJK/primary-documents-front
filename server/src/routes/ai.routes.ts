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
        let stream = await aiService.chatStream(chatMessages, currentPath);

        // Обработка tool_calls (упрощенная для стриминга)
        let toolCallDetected = false;

        for await (const part of stream) {
            if (part.message.tool_calls && part.message.tool_calls.length > 0) {
                toolCallDetected = true;
                
                // Выполняем инструменты
                const updatedMessages = [...chatMessages, part.message];
                
                for (const toolCall of part.message.tool_calls) {
                    const result = await aiService.executeTool(toolCall.function.name, toolCall.function.arguments);
                    updatedMessages.push({
                        role: 'tool',
                        content: JSON.stringify(result)
                    });
                }

                // Запускаем новый поток с результатами инструментов
                const finalStream = await aiService.chatStream(updatedMessages, currentPath);
                for await (const finalPart of finalStream) {
                    if (finalPart.message.content) {
                        res.write(`data: ${JSON.stringify({ content: finalPart.message.content })}\n\n`);
                    }
                }
                break; // Выходим из первого цикла
            }

            if (part.message.content) {
                res.write(`data: ${JSON.stringify({ content: part.message.content })}\n\n`);
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
