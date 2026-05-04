import { Ollama } from 'ollama';
import { AI_CONFIG } from '../config/ai.config.js';

export interface IMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

class AiService {
    private ollama: Ollama;

    constructor() {
        this.ollama = new Ollama({ host: AI_CONFIG.OLLAMA_HOST });
    }

    /**
     * Генерация потокового ответа
     * @param messages История сообщений
     */
    async chatStream(messages: IMessage[]) {
        // Добавляем системный промпт в начало, если его там нет
        const fullMessages: IMessage[] = [
            { role: 'system', content: AI_CONFIG.PERSONA.systemPrompt },
            ...messages
        ];

        try {
            return await this.ollama.chat({
                model: AI_CONFIG.MODEL,
                messages: fullMessages,
                stream: true,
            });
        } catch (error) {
            console.error('Ollama Service Error:', error);
            throw error;
        }
    }
}

export const aiService = new AiService();
