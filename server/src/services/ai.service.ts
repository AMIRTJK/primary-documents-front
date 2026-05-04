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
    async chatStream(messages: IMessage[], currentPath?: string) {
        let systemContent = AI_CONFIG.PERSONA.systemPrompt;
        
        if (currentPath) {
            systemContent += `\n\nКОНТЕКСТ СТРАНИЦЫ: Пользователь сейчас находится на странице: ${currentPath}. Если это уместно, предложи помощь именно по этой странице.`;
        }

        const fullMessages: IMessage[] = [
            { role: 'system', content: systemContent },
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
