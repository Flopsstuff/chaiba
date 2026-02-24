/**
 * OpenRouter provider setup.
 * API key is stored in localStorage under 'openrouter_api_key'.
 * Use createOpenRouter with the key when making AI calls.
 */
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const API_KEY_STORAGE = 'openrouter_api_key';

export function getOpenRouterProvider() {
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem(API_KEY_STORAGE) : null;
  if (!apiKey) {
    throw new Error('OpenRouter API key not set. Configure in Settings.');
  }
  return createOpenRouter({ apiKey });
}

/**
 * Example: create a model instance for chat
 * const openrouter = getOpenRouterProvider();
 * const model = openrouter('openai/gpt-3.5-turbo');
 * Use with generateText, streamText from 'ai' package.
 */
