import { Anthropic } from '@anthropic-ai/sdk';
import { AzureOpenAI } from 'openai';
import OpenAI from 'openai';

// Common message format for all providers
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Common response format
export interface LLMResponse {
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// LLM completion parameters
export interface LLMCompletionParams {
  model: string;
  messages: LLMMessage[];
  system?: string;
  temperature?: number;
  max_tokens?: number;
}

// Base interface for LLM providers
export interface LLMProvider {
  createCompletion(params: LLMCompletionParams): Promise<LLMResponse>;
  getProviderName(): string;
}

// Anthropic provider implementation
export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async createCompletion(params: LLMCompletionParams): Promise<LLMResponse> {
    // Filter out system messages from messages array
    const filteredMessages = params.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    const response = await this.client.messages.create({
      model: params.model,
      messages: filteredMessages,
      system: params.system,
      temperature: params.temperature,
      max_tokens: params.max_tokens || 1024,
    });

    const content = response.content[0];
    const textContent = content.type === 'text' ? content.text : '';

    return {
      content: textContent,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  }

  getProviderName(): string {
    return 'anthropic';
  }
}

// Azure OpenAI provider implementation
export class AzureOpenAIProvider implements LLMProvider {
  private client: AzureOpenAI;
  private deploymentName: string;

  constructor(apiKey: string, endpoint: string, deploymentName: string) {
    this.client = new AzureOpenAI({
      apiKey,
      endpoint,
      apiVersion: '2024-08-01-preview',
    });
    this.deploymentName = deploymentName;
  }

  async createCompletion(params: LLMCompletionParams): Promise<LLMResponse> {
    // Convert messages to OpenAI format
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add system message if provided
    if (params.system) {
      messages.push({
        role: 'system',
        content: params.system,
      });
    }

    // Add other messages
    params.messages.forEach(msg => {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    });

    const response = await this.client.chat.completions.create({
      model: this.deploymentName, // Azure uses deployment name instead of model
      messages,
      temperature: params.temperature,
      max_tokens: params.max_tokens || 1024,
    });

    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage;

    return {
      content,
      usage: usage
        ? {
          input_tokens: usage.prompt_tokens,
          output_tokens: usage.completion_tokens,
        }
        : undefined,
    };
  }

  getProviderName(): string {
    return 'azure-openai';
  }
}

// OpenAI provider implementation (for backward compatibility)
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async createCompletion(params: LLMCompletionParams): Promise<LLMResponse> {
    // Convert messages to OpenAI format
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add system message if provided
    if (params.system) {
      messages.push({
        role: 'system',
        content: params.system,
      });
    }

    // Add other messages
    params.messages.forEach(msg => {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    });

    const response = await this.client.chat.completions.create({
      model: params.model,
      messages,
      temperature: params.temperature,
      max_tokens: params.max_tokens || 1024,
    });

    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage;

    return {
      content,
      usage: usage
        ? {
          input_tokens: usage.prompt_tokens,
          output_tokens: usage.completion_tokens,
        }
        : undefined,
    };
  }

  getProviderName(): string {
    return 'openai';
  }
}

// Model mappings for different providers
export const PROVIDER_MODEL_MAPPINGS = {
  anthropic: {
    'gpt-4o': 'claude-3-5-sonnet-20241022',
    'gpt-4': 'claude-3-opus-20240229',
    'gpt-3.5-turbo': 'claude-3-haiku-20240307',
    'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
    'claude-3-haiku': 'claude-3-haiku-20240307',
    'claude-3-opus': 'claude-3-opus-20240229',
  },
  'azure-openai': {
    'claude-3-5-sonnet': 'gpt-4o',
    'claude-3-haiku': 'gpt-4o-mini',
    'claude-3-opus': 'gpt-4',
  },
  openai: {
    'claude-3-5-sonnet': 'gpt-4o',
    'claude-3-haiku': 'gpt-3.5-turbo',
    'claude-3-opus': 'gpt-4',
  },
  groq: {
    'claude-3-5-sonnet': 'llama3-70b-8192',
    'claude-3-haiku': 'llama3-8b-8192',
    'claude-3-opus': 'llama3-70b-8192',
  },
};

// Groq provider implementation
export class GroqProvider implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async createCompletion(params: LLMCompletionParams): Promise<LLMResponse> {
    // Convert messages to OpenAI format (compatible with Groq)
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add system message if provided
    if (params.system) {
      messages.push({
        role: 'system',
        content: params.system,
      });
    }

    // Add other messages
    params.messages.forEach(msg => {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    });

    const response = await this.client.chat.completions.create({
      model: params.model,
      messages,
      temperature: params.temperature,
      max_tokens: params.max_tokens || 1024,
    });

    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage;

    return {
      content,
      usage: usage
        ? {
          input_tokens: usage.prompt_tokens,
          output_tokens: usage.completion_tokens,
        }
        : undefined,
    };
  }

  getProviderName(): string {
    return 'groq';
  }
}

// Get the appropriate model name for the provider
export function getProviderModel(
  provider: string,
  requestedModel: string
): string {
  const mappings = PROVIDER_MODEL_MAPPINGS as Record<string, Record<string, string>>;
  const providerMappings = mappings[provider];
  if (!providerMappings) return requestedModel;
  return providerMappings[requestedModel] || requestedModel;
}
