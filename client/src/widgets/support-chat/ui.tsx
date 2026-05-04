'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Input, Card, Avatar, Space } from 'antd';
import { MessageOutlined, CloseOutlined, SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';

import { LikeOutlined, DislikeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { message } from 'antd';

interface IMessage {
    id: string;
    role: 'user' | 'ai';
    content: string;
    feedback?: 'up' | 'down';
}

const QUICK_REPLIES = [
    'О проекте',
    'Как зарегистрироваться?',
    'Личный кабинет',
];

export const SupportChat = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleFeedback = async (messageId: string, type: 'up' | 'down') => {
        try {
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, feedback: type } : msg
            ));

            await fetch('http://localhost:5000/api/ai/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId, type }),
            });

            message.success('Спасибо за ваш отзыв!');
        } catch (error) {
            console.error('Feedback error:', error);
        }
    };

    // 6. Загрузка истории из LocalStorage
    useEffect(() => {
        const saved = localStorage.getItem('chat_history');
        if (saved) {
            try {
                setMessages(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse chat history');
            }
        }
    }, []);

    // 6. Сохранение истории
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('chat_history', JSON.stringify(messages));
        }
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSend = async (text?: string) => {
        const messageText = text || inputValue;
        if (!messageText.trim()) return;

        const userMsg: IMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        const aiMsgId = (Date.now() + 1).toString();

        try {
            // 2. Передаем контекст страницы (pathname)
            const currentPath = window.location.pathname;

            const response = await fetch('http://localhost:5000/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPath,
                    messages: messages.concat(userMsg).map(m => ({
                        role: m.role === 'ai' ? 'assistant' : 'user',
                        content: m.content
                    }))
                }),
            });

            if (!response.body) throw new Error('No response body');

            setMessages((prev) => [...prev, { id: aiMsgId, role: 'ai', content: '' }]);

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let done = false;

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.replace('data: ', '');
                            if (dataStr === '[DONE]') {
                                done = true;
                                break;
                            }
                            try {
                                const parsed = JSON.parse(dataStr);
                                if (parsed.content) {
                                    setMessages((prev) => prev.map(msg =>
                                        msg.id === aiMsgId
                                            ? { ...msg, content: msg.content + parsed.content }
                                            : msg
                                    ));
                                }
                            } catch (e) {
                                console.error('Parse error', e);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching AI response:', error);
            setMessages((prev) => [
                ...prev,
                { id: aiMsgId, role: 'ai', content: 'Ошибка при получении ответа. Проверьте соединение.' }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearHistory = () => {
        setMessages([]);
        localStorage.removeItem('chat_history');
    };

    return (
        <div className="fixed! bottom-6! right-6! z-50! flex! flex-col! items-end!">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Card
                            title={
                                <Space>
                                    <Avatar size="small" icon={<RobotOutlined />} className="bg-blue-500!" />
                                    <span className="font-semibold!">Феномен</span>
                                </Space>
                            }
                            extra={
                                <Space>
                                    <Button type="text" size="small" onClick={clearHistory} className="text-gray-400! hover:text-red-500!">Очистить</Button>
                                    <Button type="text" icon={<CloseOutlined />} onClick={() => setIsOpen(false)} />
                                </Space>
                            }
                            className="w-85! shadow-2xl! mb-4! border-none! overflow-hidden!"
                            styles={{ body: { padding: 0 } }}
                        >
                            <div className="h-96! overflow-y-auto! p-4! flex! flex-col! gap-4! bg-gray-50/50!">
                                {messages.length === 0 && (
                                    <div className="text-center! mt-10!">
                                        <RobotOutlined className="text-4xl! text-blue-200! mb-2!" />
                                        <div className="text-gray-400! text-sm!">Я помогу тебе с любым вопросом о проекте Interlink</div>
                                    </div>
                                )}
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex! gap-2! ${msg.role === 'user' ? 'flex-row-reverse!' : 'flex-row!'}`}
                                    >
                                        {/* 5. Аватар */}
                                        <Avatar
                                            size="small"
                                            icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                                            className={msg.role === 'user' ? 'bg-gray-400!' : 'bg-blue-500!'}
                                        />
                                        <div
                                            className={`max-w-[80%]! p-3! rounded-2xl! shadow-sm! ${msg.role === 'user'
                                                ? 'bg-blue-600! text-white! rounded-tr-none!'
                                                : 'bg-white! border! border-gray-100! text-gray-800! rounded-tl-none!'
                                                }`}
                                        >
                                            <div className="text-[14px]! leading-relaxed!">
                                                <ReactMarkdown
                                                    components={{
                                                        a: ({ node, ...props }) => {
                                                            const isInternal = props.href?.startsWith('/');
                                                            if (isInternal) {
                                                                return (
                                                                    <Link
                                                                        href={props.href!}
                                                                        className="bg-blue-50! text-blue-600! px-2! py-1! rounded! border! border-blue-200! hover:bg-blue-100! transition-colors! inline-block! my-1! text-xs! font-bold!"
                                                                    >
                                                                        {props.children}
                                                                    </Link>
                                                                );
                                                            }
                                                            return <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-500! underline!" />;
                                                        },
                                                        p: ({ children }) => <p className="m-0!">{children}</p>
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                            {msg.role === 'ai' && msg.content && !isLoading && (
                                                <div className="flex! justify-end! gap-1! mt-1! transition-opacity!">
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={msg.feedback === 'up' ? <CheckCircleOutlined className="text-green-500!" /> : <LikeOutlined className="text-gray-300! hover:text-blue-500!" />}
                                                        onClick={() => handleFeedback(msg.id, 'up')}
                                                        className="text-[10px]! p-0! h-6! w-6!"
                                                    />
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={msg.feedback === 'down' ? <CloseOutlined className="text-red-500!" /> : <DislikeOutlined className="text-gray-300! hover:text-red-500!" />}
                                                        onClick={() => handleFeedback(msg.id, 'down')}
                                                        className="text-[10px]! p-0! h-6! w-6!"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* 3. Индикатор набора текста */}
                                {isLoading && (
                                    <div className="flex! gap-2!">
                                        <Avatar size="small" icon={<RobotOutlined />} className="bg-blue-500!" />
                                        <div className="bg-white! border! border-gray-100! p-2! px-4! rounded-2xl! rounded-tl-none! shadow-sm!">
                                            <div className="flex! gap-1! py-1!">
                                                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5! h-1.5! bg-blue-400! rounded-full!" />
                                                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5! h-1.5! bg-blue-400! rounded-full!" />
                                                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5! h-1.5! bg-blue-400! rounded-full!" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* 4. Быстрые ответы */}
                            <div className="px-3! pb-2! flex! flex-wrap! gap-2! bg-gray-50/50!">
                                {QUICK_REPLIES.map((reply) => (
                                    <Button
                                        key={reply}
                                        size="small"
                                        className="text-[11px]! rounded-full! border-gray-200! hover:border-blue-400! hover:text-blue-500!"
                                        onClick={() => handleSend(reply)}
                                        disabled={isLoading}
                                    >
                                        {reply}
                                    </Button>
                                ))}
                            </div>

                            <div className="p-3! border-t! border-gray-100! flex! gap-2! bg-white!">
                                <Input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onPressEnter={() => handleSend()}
                                    placeholder="Введите сообщение..."
                                    disabled={isLoading}
                                    variant="borderless"
                                    className="bg-gray-50! rounded-lg! px-3!"
                                />
                                <Button
                                    type="primary"
                                    shape="circle"
                                    icon={<SendOutlined />}
                                    onClick={() => handleSend()}
                                    loading={isLoading}
                                    className="shadow-md!"
                                />
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
            {!isOpen && (
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <Button
                        type="primary"
                        shape="circle"
                        size="large"
                        icon={<MessageOutlined />}
                        className="w-14! h-14! shadow-xl! bg-blue-600! border-none!"
                        onClick={() => setIsOpen(true)}
                    />
                </motion.div>
            )}
        </div>
    );
};

