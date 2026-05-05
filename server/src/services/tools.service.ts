import { getDb } from '../db/index.js';

export const AI_TOOLS = {
    /**
     * Получить общую статистику проекта
     */
    get_project_stats: async () => {
        const db = getDb();
        try {
            // Пытаемся получить список таблиц
            const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
            const tableNames = tables.map(t => t.name).filter(name => !name.startsWith('sqlite_'));
            
            // Считаем записи в таблицах (если они есть)
            const stats: Record<string, number> = {};
            for (const name of tableNames) {
                const count = await db.get(`SELECT COUNT(*) as count FROM ${name}`);
                stats[name] = count.count;
            }

            return {
                message: "Статистика базы данных получена",
                tables: tableNames,
                counts: stats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Tool Error (get_project_stats):', error);
            return { error: "Не удалось получить статистику БД" };
        }
    },

    /**
     * Проверить структуру конкретной таблицы
     */
    get_table_schema: async ({ tableName }: { tableName: string }) => {
        const db = getDb();
        try {
            const schema = await db.all(`PRAGMA table_info(${tableName})`);
            return {
                tableName,
                schema: schema.map(col => ({
                    name: col.name,
                    type: col.type,
                    notnull: col.notnull === 1,
                    pk: col.pk === 1
                }))
            };
        } catch (error) {
            return { error: `Ошибка при получении схемы таблицы ${tableName}` };
        }
    },

    /**
     * Прочитать файл проекта (для контекста)
     */
    read_project_file: async ({ filePath }: { filePath: string }) => {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            
            // Ограничиваем чтение только папкой проекта
            const fullPath = path.resolve(process.cwd(), filePath);
            if (!fullPath.startsWith(process.cwd())) {
                return { error: "Доступ запрещен. Можно читать только файлы внутри проекта." };
            }

            const content = await fs.readFile(fullPath, 'utf-8');
            return {
                filePath,
                content: content.slice(0, 5000), // Ограничиваем объем, чтобы не перегрузить контекст
                truncated: content.length > 5000
            };
        } catch (error) {
            return { error: `Не удалось прочитать файл: ${filePath}` };
        }
    },

    /**
     * Получить статистику фидбека по ИИ
     */
    get_ai_feedback_stats: async () => {
        const db = getDb();
        try {
            const stats = await db.all(`
                SELECT 
                    type, 
                    COUNT(*) as count 
                FROM ai_feedback 
                GROUP BY type
            `);
            
            const lastComments = await db.all(`
                SELECT comment, createdAt 
                FROM ai_feedback 
                WHERE comment IS NOT NULL 
                ORDER BY createdAt DESC 
                LIMIT 5
            `);

            const total = stats.reduce((acc, curr) => acc + curr.count, 0);
            const likes = stats.find(s => s.type === 'up')?.count || 0;
            const dislikes = stats.find(s => s.type === 'down')?.count || 0;

            return {
                total,
                likes,
                dislikes,
                approvalRate: total > 0 ? ((likes / total) * 100).toFixed(1) + '%' : '0%',
                recentComments: lastComments
            };
        } catch (error) {
            console.error('Tool Error (get_ai_feedback_stats):', error);
            return { error: "Не удалось получить статистику фидбека" };
        }
    }
};

export type TToolName = keyof typeof AI_TOOLS;
