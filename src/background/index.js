/**
 * Service Worker для Chrome Extension
 * Главная точка входа для background скриптов
 *
 * @version 2.0.0 - Simplified
 * @description Запускает роутер сообщений для обработки запросов
 */

import { messageRouter } from './message-router.js';

// Запускаем роутер сообщений
messageRouter.start();

console.log('[Background] Service Worker готов');
