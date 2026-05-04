'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Card, Typography } from 'antd';
import { MessageOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface IMessage {
    id: string;
    role: 'user' | 'ai';
    content: string;
}

export const SupportChat = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        const userMsg: IMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        const aiMsgId = (Date.now() + 1).toString();
        setMessages((prev) => [...prev, { id: aiMsgId, role: 'ai', content: '' }]);

        try {
            const response = await fetch('http://localhost:5000/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    messages: messages.map(m => ({
                        role: m.role === 'ai' ? 'assistant' : 'user',
                        content: m.content
                    })).concat({ role: 'user', content: inputValue })
                }),
            });

            if (!response.body) throw new Error('No response body');

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
            setMessages((prev) => prev.map(msg =>
                msg.id === aiMsgId
                    ? { ...msg, content: 'Ошибка при получении ответа.' }
                    : msg
            ));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed! bottom-6! right-6! z-50! flex! flex-col! items-end!">
            {isOpen && (
                <Card
                    title="AI Помощник"
                    extra={<Button type="text" icon={<CloseOutlined />} onClick={() => setIsOpen(false)} />}
                    className="w-80! shadow-xl! mb-4!"
                    bodyStyle={{ padding: 0 }}
                >
                    <div className="h-96! overflow-y-auto! p-4! flex! flex-col! gap-3! bg-gray-50!">
                        {messages.length === 0 && (
                            <Text type="secondary" className="text-center! mt-4!">Чем могу помочь?</Text>
                        )}
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`max-w-[85%]! p-3! rounded-lg! ${msg.role === 'user'
                                    ? 'bg-blue-500! text-white! self-end! rounded-br-none!'
                                    : 'bg-white! border! border-gray-200! self-start! rounded-bl-none!'
                                    }`}
                            >
                                <Text className={msg.role === 'user' ? 'text-white!' : ''}>
                                    {msg.content}
                                </Text>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-3! border-t! flex! gap-2!">
                        <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onPressEnter={handleSend}
                            placeholder="Введите сообщение..."
                            disabled={isLoading}
                        />
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={handleSend}
                            loading={isLoading}
                        />
                    </div>
                </Card>
            )}
            {!isOpen && (
                <Button
                    type="primary"
                    shape="circle"
                    size="large"
                    icon={<MessageOutlined />}
                    className="w-14! h-14! shadow-lg!"
                    onClick={() => setIsOpen(true)}
                />
            )}
        </div>
    );
};
