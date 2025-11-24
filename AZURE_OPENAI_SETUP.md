# Azure OpenAI Integration Guide

This guide explains how to configure and use Azure OpenAI as an alternative LLM provider in CorePragya Advanced.

## Overview

CorePragya Advanced now supports multiple LLM providers:
- **Anthropic Claude** (default)
- **Azure OpenAI** (new)
- **OpenAI** (legacy support)

You can switch between providers using the `LLM_PROVIDER` environment variable.

## Setup Instructions

### 1. Azure OpenAI Prerequisites

Before you begin, you need:
- An active Azure subscription
- An Azure OpenAI resource created in Azure Portal
- A deployed model (e.g., GPT-4o, GPT-4, GPT-3.5-turbo)

### 2. Get Your Azure OpenAI Credentials

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Azure OpenAI resource
3. Go to "Keys and Endpoint" section
4. Copy the following:
   - **API Key** (Key 1 or Key 2)
   - **Endpoint** (e.g., `https://your-resource-name.openai.azure.com`)
5. Note your **Deployment Name** (found in "Model deployments" section)

### 3. Configure Environment Variables

Update your `.env.local` file with the following variables:

```env
# LLM Provider Configuration
# Options: 'anthropic', 'azure-openai', 'openai'
LLM_PROVIDER=azure-openai

# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your-azure-openai-api-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
```

### 4. Example Configuration

```env
# Example with Azure OpenAI
LLM_PROVIDER=azure-openai
AZURE_OPENAI_API_KEY=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
AZURE_OPENAI_ENDPOINT=https://corepragya-openai.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
```

## Provider Comparison

| Feature | Anthropic Claude | Azure OpenAI | OpenAI |
|---------|-----------------|--------------|--------|
| Models | Claude 3.5 Sonnet, Haiku, Opus | GPT-4o, GPT-4, GPT-3.5 | GPT-4o, GPT-4, GPT-3.5 |
| Hosting | Anthropic Cloud | Azure Cloud | OpenAI Cloud |
| Enterprise Features | ✓ | ✓ | Limited |
| Regional Deployment | Limited | ✓ | Limited |
| Data Residency | US | Configurable | US |

## Model Mappings

The system automatically maps between provider-specific model names:

### When using Azure OpenAI:
- `claude-3-5-sonnet` → `gpt-4o`
- `claude-3-haiku` → `gpt-4o-mini`
- `claude-3-opus` → `gpt-4`

### When using Anthropic (default):
- `gpt-4o` → `claude-3-5-sonnet-20241022`
- `gpt-4` → `claude-3-opus-20240229`
- `gpt-3.5-turbo` → `claude-3-haiku-20240307`

## Switching Providers

To switch between providers, simply update the `LLM_PROVIDER` variable in your `.env.local` file:

### Use Anthropic Claude (default)
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### Use Azure OpenAI
```env
LLM_PROVIDER=azure-openai
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
```

### Use OpenAI (legacy)
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key
```

## Affected Features

All AI-powered features in CorePragya will use the selected LLM provider:

1. **PDF Processing** - Extracts summaries, key points, and insights from PDFs
2. **URL Processing** - Analyzes and categorizes web content
3. **Email Processing** - Summarizes content from email links
4. **RAG Search** - Provides context-aware answers from your knowledge base

## Troubleshooting

### Error: "AZURE_OPENAI_API_KEY is required"
- Make sure you've set all three Azure OpenAI environment variables
- Verify the variables are in `.env.local` (not just `.env.example`)
- Restart your development server after adding variables

### Error: "Failed to create completion"
- Check that your Azure OpenAI endpoint URL is correct
- Verify your deployment name matches exactly (case-sensitive)
- Ensure your Azure OpenAI resource has an active deployment
- Check your API key hasn't expired

### Error: "Model not found"
- The deployment name must match exactly with what you created in Azure
- Use the deployment name, not the model name
- Example: Use `my-gpt4-deployment` not `gpt-4`

### Slow Response Times
- Azure OpenAI performance depends on your region and tier
- Consider using a faster model (e.g., GPT-3.5 instead of GPT-4)
- Check your Azure OpenAI quota and rate limits

## Cost Considerations

### Azure OpenAI Pricing
- Charged per 1,000 tokens (input + output)
- Pricing varies by model and region
- Can set spending limits in Azure Portal
- Check [Azure OpenAI Pricing](https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/)

### Anthropic Pricing
- Charged per 1,000 tokens (input + output)
- Different pricing for Haiku, Sonnet, and Opus
- Check [Anthropic Pricing](https://www.anthropic.com/pricing)

### Optimization Tips
1. Use cheaper models for simple tasks (Haiku/GPT-3.5)
2. Use expensive models for complex reasoning (Opus/GPT-4)
3. Limit max_tokens in responses
4. Cache frequently used content
5. Truncate long documents before processing

## Architecture Details

### Provider Abstraction Layer

The system uses a provider abstraction pattern located in [`lib/llm-provider.ts`](lib/llm-provider.ts):

```typescript
interface LLMProvider {
  createCompletion(params: LLMCompletionParams): Promise<LLMResponse>;
  getProviderName(): string;
}
```

This allows seamless switching between providers without code changes.

### Provider Factory

The factory function in [`lib/ai-clients.ts`](lib/ai-clients.ts) automatically selects and initializes the correct provider based on `LLM_PROVIDER`:

```typescript
const llmProvider = getLLMProvider();
const response = await llmProvider.createCompletion({
  model: modelName,
  messages: [...],
  temperature: 0.3,
  max_tokens: 1000
});
```

## Additional Resources

- [Azure OpenAI Documentation](https://learn.microsoft.com/azure/ai-services/openai/)
- [Anthropic Claude Documentation](https://docs.anthropic.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)

## Support

If you encounter issues:
1. Check the error logs in your terminal
2. Verify all environment variables are set correctly
3. Ensure your API keys have the necessary permissions
4. Check provider-specific status pages for outages

---

**Last Updated:** 2025-11-24
