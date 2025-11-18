# CorePragyaAdvanced

## Project Overview

CorePragyaAdvanced is an advanced AI-powered knowledge management and insights platform built with Next.js. The application combines RAG (Retrieval Augmented Generation) technology with email integration, PDF processing, and multi-modal AI capabilities to help users manage and extract insights from their knowledge base.

## Tech Stack

### Core Framework
- **Next.js 15.2.4** - React framework with App Router
- **React 19** - UI library
- **TypeScript 5** - Type-safe JavaScript
- **Tailwind CSS 3.4** - Utility-first CSS framework

### Backend & Database
- **Supabase** - PostgreSQL database and authentication
- **Supabase Auth Helpers** - Authentication integration for Next.js

### AI & ML
- **Anthropic Claude SDK** (@anthropic-ai/sdk) - Claude AI integration
- **OpenAI SDK** - GPT models integration
- **Cohere AI** - Embedding generation and search

### UI Components
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - Re-usable components built with Radix UI
- **Lucide React** - Icon library
- **Recharts & Chart.js** - Data visualization

### Authentication & APIs
- **Google Auth Library** - Google OAuth integration
- **Google APIs** - Gmail API integration
- **Supabase SSR** - Server-side rendering auth

### Utilities
- **Zod** - Schema validation
- **React Hook Form** - Form management
- **Fuse.js** - Fuzzy search
- **pdf-parse** - PDF document parsing
- **LRU Cache** - Caching implementation

## Project Structure

```
/app                          # Next.js App Router
  /api                        # API routes
    /auth                     # Authentication endpoints
      /callback/google        # Google OAuth callback
      /google                 # Google OAuth initiation
    /embedding-stats          # Embedding statistics
    /generate-embeddings      # Generate embeddings from content
    /generate-insights        # AI-powered insights generation
    /gmail                    # Gmail integration endpoints
    /process-pdf              # PDF processing
    /process-url              # URL content processing
    /rag-search               # RAG search endpoint
    /refresh-from-email       # Email refresh functionality
  /dashboard                  # Main dashboard page
  /knowledge-base             # Knowledge base management
  /login                      # Authentication page
  /setup/gmail                # Gmail setup flow
  /debug                      # Debug utilities

/components                   # React components
  /ui                         # shadcn/ui components

/hooks                        # Custom React hooks
  useEnhancedSearch.ts        # Enhanced search functionality
  use-toast.ts                # Toast notifications

/lib                          # Utility libraries and clients
  /auth                       # Authentication utilities
    googleAuth.ts             # Google OAuth implementation
  /email                      # Email service
    emailService.ts           # Gmail integration service
  /supabase                   # Supabase clients
    client.ts                 # Supabase client configuration
  ai-clients.ts               # AI SDK clients (Anthropic, OpenAI, Cohere)
  accessibility-utils.ts      # Accessibility helpers
  knowledge-utils.ts          # Knowledge base utilities
  pdf-parser.ts               # PDF parsing logic
  performance-monitor.ts      # Performance monitoring
  rate-limiting.ts            # API rate limiting
  utils.ts                    # General utilities

/scripts                      # Database and utility scripts
  apply-migrations.js         # Database migration runner
  clear-expired-tokens.js     # Token cleanup
  create-gmail-tokens-table.js # Gmail token table setup
  create-knowledgebase-table.js # Knowledge base table setup
  diagnose-gmail-oauth.js     # OAuth diagnostics
  fix-embeddings-dimensions.js # Embedding dimension fixes
  verify-oauth-readiness.js   # OAuth verification

/migrations                   # Database migration files

/public                       # Static assets

/styles                       # Global styles

/types                        # TypeScript type definitions
  pdf-parse.d.ts              # PDF parsing types
```

## Key Features

### 1. RAG (Retrieval Augmented Generation)
- Vector embeddings using Cohere
- Semantic search across knowledge base
- AI-powered insights generation using Claude and GPT models

### 2. Knowledge Base Management
- Store and organize documents
- PDF processing and text extraction
- URL content extraction
- Embedding generation and storage

### 3. Gmail Integration
- OAuth 2.0 authentication with Google
- Email content extraction
- Automatic knowledge base updates from emails
- Token management and refresh

### 4. AI-Powered Insights
- Multi-model support (Claude, GPT)
- Actionable insights generation
- Context-aware responses

### 5. Authentication
- Google OAuth integration
- Supabase authentication
- Session management with SSR support

## Development Guidelines

### Running the Application

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Environment Variables

Required environment variables (create `.env.local`):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# AI Services
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
COHERE_API_KEY=your_cohere_api_key
```

### Database Setup

```bash
# Create required tables
node scripts/create-knowledgebase-table.js
node scripts/create-gmail-tokens-table.js

# Apply migrations
node scripts/apply-migrations.js

# Verify OAuth setup
node scripts/verify-oauth-readiness.js
```

### Code Conventions

#### TypeScript
- Use TypeScript for all new files
- Define proper types and interfaces
- Avoid `any` types when possible
- Use Zod for runtime validation

#### Components
- Use functional components with hooks
- Follow React Server Components pattern
- Keep components small and focused
- Use shadcn/ui for UI components

#### Styling
- Use Tailwind CSS utility classes
- Follow mobile-first responsive design
- Use CSS variables for theming
- Maintain consistent spacing and typography

#### API Routes
- Use Next.js App Router API routes
- Implement proper error handling
- Add rate limiting for public endpoints
- Return typed responses

#### State Management
- Use React hooks for local state
- Leverage server components when possible
- Minimize client-side state

### Security Considerations

- **Never commit API keys** to version control
- Use environment variables for sensitive data
- Implement rate limiting on API endpoints
- Validate all user inputs with Zod
- Use Supabase RLS (Row Level Security)
- Sanitize PDF and URL content before processing

### Performance Best Practices

- Use Next.js Image component for images
- Implement proper caching strategies
- Use Server Components by default
- Lazy load heavy components
- Monitor performance with the performance monitor utility

## Common Tasks

### Adding a New AI Model
1. Add SDK to dependencies: `npm install <sdk-name>`
2. Update `lib/ai-clients.ts` with new client
3. Add API key to environment variables
4. Implement in relevant API routes

### Creating a New API Endpoint
1. Create route file in `/app/api/<endpoint>/route.ts`
2. Implement handler with proper types
3. Add error handling and validation
4. Add rate limiting if needed
5. Test with different inputs

### Adding a New Page
1. Create page file in `/app/<route>/page.tsx`
2. Implement Server Component if possible
3. Add proper metadata
4. Style with Tailwind CSS
5. Test responsive behavior

### Database Migration
1. Create migration file in `/migrations`
2. Test migration locally
3. Update relevant scripts if needed
4. Run `node scripts/apply-migrations.js`

## Testing & Debugging

### Debug Utilities
- Debug page available at `/debug`
- Gmail OAuth diagnostics: `node scripts/diagnose-gmail-oauth.js`
- Check token status with `/api/gmail/status`

### Common Issues

1. **OAuth Not Working**: Run `node scripts/verify-oauth-readiness.js`
2. **Embedding Dimensions**: Run `node scripts/fix-embeddings-dimensions.js`
3. **Expired Tokens**: Run `node scripts/clear-expired-tokens.js`

## Additional Notes

- The application uses middleware for route protection
- Rate limiting is implemented at the library level
- Performance monitoring tracks API response times
- Accessibility utilities ensure WCAG compliance
- The app supports dark mode via next-themes
