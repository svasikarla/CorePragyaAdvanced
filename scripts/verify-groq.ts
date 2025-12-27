
// Scripts to verify LLM provider configuration
import { getLLMProvider, getModelForProvider } from '@/lib/ai-clients';

// Mock environment variables for testing
const originalEnv = process.env;

async function testGroqConfiguration() {
    console.log('Testing Groq Configuration...');

    // Set environment variables for testing
    process.env.LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'test-key';

    try {
        const provider = getLLMProvider();
        console.log(`Provider instantiated: ${provider.getProviderName()}`);

        if (provider.getProviderName() !== 'groq') {
            throw new Error('Expected provider name to be "groq"');
        }

        const model = getModelForProvider('claude-3-5-sonnet');
        console.log(`Model mapping for claude-3-5-sonnet: ${model}`);

        if (model !== 'llama3-70b-8192') {
            throw new Error(`Expected model to be "llama3-70b-8192", got "${model}"`);
        }

        console.log('✅ Groq configuration verification passed!');
    } catch (error) {
        console.error('❌ Groq verification failed:', error);
    } finally {
        // Restore environment
        process.env = originalEnv;
    }
}

testGroqConfiguration();
