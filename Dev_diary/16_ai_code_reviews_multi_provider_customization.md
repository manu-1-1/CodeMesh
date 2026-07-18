# AI Code Review Customization & Multi-Provider Integration

This document outlines the architecture, database schema, backend API logic, frontend settings panel, and style adjustments I implemented to add user-configurable AI Code Reviews (supporting Ollama, OpenAI, Anthropic/Claude, and Google Gemini).

---

## 1. Architectural Overview

Originally, CodeMesh used a mock rules-based review scanner. The updated system allows users to select their active AI provider and customize their connection settings directly from their profile:
1. **Providers**: Users can select from Ollama (local), OpenAI (ChatGPT), Anthropic (Claude), and Google Gemini. The default provider is set to **Ollama**.
2. **On-Demand Configuration**: For security, sensitive AI API keys are never returned to the browser during login or session restore. Instead, a dedicated `/users/ai-settings` endpoint fetches them on-demand when the settings tab is opened, masking keys as `••••••••••••••••`.
3. **Server-Side Execution**: Snippet reviews are requested by ID. The backend fetches the snippet, queries the database for the user's secret credentials, runs the prompt request on the server, and saves the final result.
4. **Connection Error Handling**: If an API call fails or the Ollama server is offline, the reviewer generates a formatted error card outlining the troubleshooting details (such as checking if the local Ollama app is open).

---

## 2. Code Changes and Explanations

### A. Database Schema
**File**: [schema.prisma](file:///d:/Projects/CodeMesh/backend/prisma/schema.prisma)

I added columns to the `User` model to persist preferences:
```prisma
model User {
  id               String            @id @default(uuid())
  name             String
  email            String            @unique
  passwordHash     String
  avatarUrl        String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  workspaces       Workspace[]       @relation("WorkspaceOwner")
  memberships      WorkspaceMember[]
  messages         Message[]
  snippets         Snippet[]
  githubConnection GitHubConnection? 
  invitationsSent  Invitation[]      @relation("Inviter")
  
  // Custom AI Settings fields
  aiProvider       String?           @default("ollama")
  aiApiKey         String?
  aiModel          String?
  aiApiUrl         String?

  @@map("users")
}
```
*Note: A database migration (`add_user_ai_settings`) was created and applied using `npx prisma migrate dev`.*

---

### B. User Profile APIs
**File**: [users.js](file:///d:/Projects/CodeMesh/backend/src/routes/users.js)

I added a GET endpoint to load settings on-demand (with masked API keys) and updated the profile PUT endpoint to handle updates securely.

#### 1. On-Demand Getter (Masking API Keys)
```javascript
// Get User's AI Configuration Settings (Only fetched when opening Settings panel)
router.get('/ai-settings', async (req, res) => {
    const userId = req.user.id;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                aiProvider: true,
                aiModel: true,
                aiApiUrl: true,
                aiApiKey: true 
            }
        });
        
        if (user) {
            // Mask the API key so the raw secret is never sent to the browser
            if (user.aiApiKey) {
                user.aiApiKey = "••••••••••••••••";
            }
            res.json(user);
        } else {
            res.json({ aiProvider: 'ollama', aiModel: '', aiApiUrl: '', aiApiKey: '' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

#### 2. Profile Updater (Preserves Masked Keys)
```javascript
router.put('/profile', async (req, res) => {
    const { name, avatarUrl, aiProvider, aiApiKey, aiModel, aiApiUrl } = req.body;
    const userId = req.user.id;

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                name: name !== undefined ? name : undefined,
                avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
                aiProvider: aiProvider !== undefined ? aiProvider : undefined,
                // If the key is the masked placeholder, ignore it so we don't overwrite the real DB value
                aiApiKey: (aiApiKey !== undefined && aiApiKey !== "••••••••••••••••") ? aiApiKey : undefined,
                aiModel: aiModel !== undefined ? aiModel : undefined,
                aiApiUrl: aiApiUrl !== undefined ? aiApiUrl : undefined,
            },
            select: { 
                id: true, 
                name: true, 
                email: true, 
                avatarUrl: true, 
                createdAt: true,
                aiProvider: true,
                aiModel: true,
                aiApiUrl: true
            },
        });
        res.json({
            message: 'Profile updated successfully',
            user: updatedUser,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

---

### C. Review Execution Route
**File**: [reviews.js](file:///d:/Projects/CodeMesh/backend/src/routes/reviews.js)

I modified the endpoint to run asynchronously and pass user-specific database configurations:
```javascript
router.post('/', async (req, res) => {
    const { snippetId } = req.body;
    const userId = req.user.id;

    if (!snippetId) {
        return res.status(400).json({ error: 'snippetId is required' });
    }
    try {
        const snippet = await prisma.snippet.findUnique({
            where: { id: snippetId }
        });
        if (!snippet) {
            return res.status(404).json({ error: 'Snippet not found' });
        }

        // Verify membership...
        const member = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: snippet.workspaceId, userId } }
        });
        if (!member) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        }

        // Fetch this user's private AI configurations directly from the DB
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                aiProvider: true,
                aiApiKey: true,
                aiModel: true,
                aiApiUrl: true
            }
        });

        // Run the code analyzer asynchronously
        const reviewResult = await performAIReview(snippet.title, snippet.language, snippet.code, user);

        // Store the result in database
        const codeReview = await prisma.codeReview.create({
            data: {
                snippetId: snippet.id,
                summary: reviewResult.summary,
                reviewerType: reviewResult.reviewerType
            }
        });
        res.status(201).json(codeReview);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

---

### D. AI Reviewer Engine & Prompt Formatting
**File**: [aiReviewer.js](file:///d:/Projects/CodeMesh/backend/src/utils/aiReviewer.js)

This module conducts reviews using native Node.js `fetch`. It includes a strict formatting prompt constraint to match the frontend parser.

#### 1. System Prompt Constraints
```javascript
const systemPrompt = "You are a professional, security-focused code review assistant. Inspect the following code snippet for critical bugs, security exploits, styling mistakes, and performance optimizations.\n\n" +
                     "CRITICAL FORMATTING REQUIREMENT:\n" +
                     "You MUST return your findings as a simple list of bullet points. Each bullet point MUST be a single line, and MUST start with exactly '- [SECURITY] ', '- [QUALITY] ', or '- [STYLE] '.\n" +
                     "Example format:\n" +
                     "- [SECURITY] Avoid using hardcoded credentials.\n" +
                     "- [STYLE] Use modern let/const variable declarations instead of var.\n\n" +
                     "Do NOT use markdown headers, bold headers like **[SECURITY]**, or split findings into multiple paragraphs. Keep each finding strictly on a single line. Do not write any introduction or conclusion text.";
```

#### 2. Provider Selection logic
- **Ollama**: Sends system and user messages to `http://localhost:11434/api/chat`.
- **OpenAI**: Uses a standard bearer token header and routes to `https://api.openai.com/v1/chat/completions`.
- **Anthropic**: Attaches the Anthropic API key header to `https://api.anthropic.com/v1/messages`.
- **Gemini**: Appends the key parameter to the Google AI URL endpoint `https://generativelanguage.googleapis.com/v1beta/models/...:generateContent`.
- **Error catch fallback**: If any call fails, it returns a formatted review error listing instructions for the user:
  ```javascript
  return {
      reviewerType: "CodeMesh AI Error",
      summary: `- [SECURITY] Connection failed: unable to reach your AI provider (${provider}).\n` +
               `- [QUALITY] Error detail: ${e.message || "Unknown network error"}.\n` +
               `- [STYLE] Please verify that your local Ollama app is running or that your API keys are correct in Settings.`
  };
  ```

---

### E. Frontend Settings UI
**File**: [SettingsArea.jsx](file:///d:/Projects/CodeMesh/frontend/src/SettingsArea.jsx)

1. **State Hooks**:
   ```javascript
   const [aiProvider, setAiProvider] = useState('ollama');
   const [aiApiKey, setAiApiKey] = useState('');
   const [aiModel, setAiModel] = useState('');
   const [aiApiUrl, setAiApiUrl] = useState('');
   const [loadingAi, setLoadingAi] = useState(false);
   const [aiSuccess, setAiSuccess] = useState('');
   ```
2. **On-demand Loading**:
   ```javascript
   useEffect(() => {
       const fetchAiSettings = async () => {
           try {
               const data = await apiRequest('/users/ai-settings');
               if (data) {
                   setAiProvider(data.aiProvider || 'ollama');
                   setAiModel(data.aiModel || '');
                   setAiApiUrl(data.aiApiUrl || '');
                   setAiApiKey(data.aiApiKey || '');
               }
           } catch (err) {
               console.error("Failed to load user AI settings: ", err.message);
           }
       };
       fetchAiSettings();
   }, []);
   ```
3. **Saving Preferences**: Form updates selections and displays inline feedback, automatically masking the API key in the UI.

---

### F. Styling and Scrolling Fixes
**File**: [SnippetsArea.css](file:///d:/Projects/CodeMesh/frontend/src/SnippetsArea.css)

Flexbox elements default to `min-height: auto`, which causes containers containing large lists of review history cards to expand rather than clip and scroll. I applied `min-height: 0` constraints to the flex layouts to enforce viewport bounds and allow proper overflow scrolling:
```css
.snippets-grid {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    height: 100%;
    min-height: 0; /* Enable scroll inside grid items */
}

.code-viewer-panel,
.review-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0; /* Enable flex-grow item scroll */
    border-right: 1px solid var(--border-color);
    background-color: var(--bg-primary);
}
```

---

## 3. Usage & Testing

1. **Ollama Integration**:
   - Ensure the Ollama client is running locally.
   - Run `ollama pull llama3.1:8b` in your shell.
   - Configure Ollama settings in the Settings tab, using `http://localhost:11434` and model `llama3.1:8b`.
   - Click **Run AI Review** in the snippets area. The new findings are rendered securely and dynamically.
