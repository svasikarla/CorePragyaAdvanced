import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLLMProvider, getModelForProvider } from '@/lib/ai-clients';

// Mock dependencies
vi.mock('@anthropic-ai/sdk', () => ({
    Anthropic: vi.fn(),
}));

vi.mock('openai', () => {
    return {
        default: vi.fn(),
        AzureOpenAI: vi.fn(),
    };
});

vi.mock('cohere-ai', () => ({
    CohereClient: vi.fn(),
}));

// Mock environment variables
const originalEnv = process.env;

describe('AI Clients Library', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.clearAllMocks();
    });

    describe('getLLMProvider', () => {
        it('should return Anthropic provider by default', () => {
            process.env.LLM_PROVIDER = 'anthropic';
            process.env.ANTHROPIC_API_KEY = 'test-key';

            const provider = getLLMProvider();
            expect(provider.getProviderName()).toBe('anthropic');
        });

        it('should return OpenAI provider when configured', () => {
            process.env.LLM_PROVIDER = 'openai';
            process.env.OPENAI_API_KEY = 'test-key';

            const provider = getLLMProvider();
            expect(provider.getProviderName()).toBe('openai');
        });

        it('should return Azure OpenAI provider when configured', () => {
            process.env.LLM_PROVIDER = 'azure-openai';
            process.env.AZURE_OPENAI_API_KEY = 'test-key';
            process.env.AZURE_OPENAI_ENDPOINT = 'test-endpoint';
            process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment';

            const provider = getLLMProvider();
            expect(provider.getProviderName()).toBe('azure-openai');
        });

        it('should throw error if Anthropic API key is missing', () => {
            process.env.LLM_PROVIDER = 'anthropic';
            delete process.env.ANTHROPIC_API_KEY;

            expect(() => getLLMProvider()).toThrow('ANTHROPIC_API_KEY is required');
        });
    });

    describe('getModelForProvider', () => {
        it('should return mapped model for Anthropic', () => {
            process.env.LLM_PROVIDER = 'anthropic';
            expect(getModelForProvider('gpt-4o')).toBe('claude-3-5-sonnet-20241022');
        });

        it('should return mapped model for Azure OpenAI', () => {
            process.env.LLM_PROVIDER = 'azure-openai';
            expect(getModelForProvider('claude-3-5-sonnet')).toBe('gpt-4o');
        });

        it('should return original model if no mapping exists', () => {
            process.env.LLM_PROVIDER = 'anthropic';
            expect(getModelForProvider('unknown-model')).toBe('unknown-model');
        });
    });
});
