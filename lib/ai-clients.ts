import { Anthropic } from '@anthropic-ai/sdk';
import { CohereClient } from 'cohere-ai';
import OpenAI from 'openai';

// Initialize OpenAI client (keeping for backward compatibility during migration)
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Anthropic client
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize Cohere client
export const cohere = new CohereClient({
  token: process.env.CO_API_KEY || '',
});

// Model mappings for easy migration
export const MODEL_MAPPINGS = {
  // OpenAI to Anthropic model mappings
  'gpt-4o': 'claude-3-5-sonnet',
  'gpt-4': 'claude-3-opus',
  'gpt-3.5-turbo': 'claude-3-haiku',
  
  // Embedding model mappings
  'text-embedding-3-small': 'embed-english-v3.0', // Cohere model
  'text-embedding-3-large': 'embed-english-v3.0', // Cohere model
};

// Helper function to get the appropriate model based on OpenAI model name
export function getModelMapping(openaiModel: string): string {
  return MODEL_MAPPINGS[openaiModel] || openaiModel;
}

// Helper function to convert OpenAI message format to Anthropic format
export function convertMessagesToAnthropicFormat(messages: any[]): any[] {
  return messages.map(msg => {
    // Map OpenAI roles to Anthropic roles
    let role = msg.role;
    if (role === 'system') {
      // Anthropic handles system messages differently
      return {
        role: 'assistant',
        content: msg.content
      };
    }
    
    return {
      role: role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    };
  });
}

// Helper function to generate embeddings using Cohere
export async function generateEmbeddings(texts: string | string[]): Promise<number[][]> {
  if (!process.env.CO_API_KEY || process.env.CO_API_KEY === 'your_cohere_api_key_here') {
    throw new Error('CO_API_KEY environment variable is not set or is using placeholder value. Please get your API key from https://cohere.ai/');
  }

  const response = await cohere.embed({
    texts: Array.isArray(texts) ? texts : [texts],
    model: 'embed-english-v3.0',
    inputType: 'search_query'
  });

  return response.embeddings;
}


