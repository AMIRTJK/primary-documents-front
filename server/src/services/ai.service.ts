import { Ollama } from 'ollama';
import { AI_CONFIG } from '../config/ai.config.js';
import { AI_TOOLS, type TToolName } from './tools.service.js';

export interface IMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_calls?: any[];
}

class AiService {
    private ollama: Ollama;

    constructor() {
        this.ollama = new Ollama({ host: AI_CONFIG.OLLAMA_HOST });
    }

    /**
     * Определения инструментов для модели
     */
    private getToolsDefinition() {
        return [
            {
                type: 'function',
                function: {
                    name: 'get_project_stats',
                    description: 'Получить общую статистику базы данных проекта (список таблиц и количество записей)',
                    parameters: { type: 'object', properties: {} }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_table_schema',
                    description: 'Получить структуру (колонки и типы данных) конкретной таблицы',
                    parameters: {
                        type: 'object',
                        properties: {
                            tableName: { type: 'string', description: 'Имя таблицы' }
                        },
                        required: ['tableName']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'read_project_file',
                    description: 'Прочитать содержимое файла проекта для анализа кода или структуры',
                    parameters: {
                        type: 'object',
                        properties: {
                            filePath: { type: 'string', description: 'Путь к файлу относительно корня проекта (напр. server/src/index.ts)' }
                        },
                        required: ['filePath']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_ai_feedback_stats',
                    description: 'Получить статистику лайков/дизлайков и последние комментарии пользователей о работе ИИ',
                    parameters: { type: 'object', properties: {} }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'navigate_user',
                    description: 'Перенаправить пользователя на другую страницу сайта (роутинг)',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'Путь для перенаправления (например, "/", "/auth", "/profile")' },
                            reason: { type: 'string', description: 'Краткое объяснение причины перенаправления (для логов)' }
                        },
                        required: ['path', 'reason']
                    }
                }
            }
        ];
    }

    /**
     * Генерация потокового ответа с поддержкой инструментов
     */
    async *chatStream(messages: IMessage[], currentPath?: string) {
        let systemContent = AI_CONFIG.PERSONA.systemPrompt;
        
        if (currentPath) {
            systemContent += `\n\nКОНТЕКСТ СТРАНИЦЫ: Пользователь сейчас находится на странице: ${currentPath}. Если это уместно, предложи помощь именно по этой странице.`;
        }

        // Инструкция по инструментам
        systemContent += `\n\nТЕХНИЧЕСКИЕ ВОЗМОЖНОСТИ: У тебя есть доступ к инструментам для проверки базы данных проекта. Если тебе нужна статистика или схема таблиц, используй соответствующие функции.`;

        const fullMessages: IMessage[] = [
            { role: 'system', content: systemContent },
            ...messages
        ];

        try {
            const response = await this.ollama.chat({
                model: AI_CONFIG.MODEL,
                messages: fullMessages,
                stream: false, // Отключаем стриминг для стабильности инструментов
                tools: this.getToolsDefinition() as any,
            });

            yield response;
        } catch (error) {
            console.error('Ollama Service Error:', error);
            throw error;
        }
    }

    /**
     * Выполнение инструмента
     */
    async executeTool(name: string, args: any) {
        const tool = AI_TOOLS[name as TToolName];
        if (tool) {
            return await tool(args);
        }
        return { error: `Инструмент ${name} не найден` };
    }
}

export const aiService = new AiService();
