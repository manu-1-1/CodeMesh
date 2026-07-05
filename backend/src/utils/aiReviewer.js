/**
 * AI review service that supports Ollama, OpenAI, Claude, and Gemini.
 */
export const performAIReview = async (title, language, code, settings) => {
    const provider = settings?.aiProvider || "ollama";
    const apiKey = settings?.aiApiKey || "";
    const model = settings?.aiModel || "";
    const apiUrl = settings?.aiApiUrl || "";

    const systemPrompt = "You are a professional, security-focused code review assistant. Inspect the following code snippet for critical bugs, security exploits, styling mistakes, and performance optimizations.\n\n" +
                         "CRITICAL FORMATTING REQUIREMENT:\n" +
                         "You MUST return your findings as a simple list of bullet points. Each bullet point MUST be a single line, and MUST start with exactly '- [SECURITY] ', '- [QUALITY] ', or '- [STYLE] '.\n" +
                         "Example format:\n" +
                         "- [SECURITY] Avoid using hardcoded credentials.\n" +
                         "- [STYLE] Use modern let/const variable declarations instead of var.\n\n" +
                         "Do NOT use markdown headers, bold headers like **[SECURITY]**, or split findings into multiple paragraphs. Keep each finding strictly on a single line. Do not write any introduction or conclusion text.";
    const userPrompt = `Snippet Title: ${title}\nLanguage: ${language}\n\nCode Snippet:\n\`\`\`${language}\n${code}\n\`\`\``;

    try {
        if (provider === "ollama") {
            const url = `${apiUrl || 'http://localhost:11434'}/api/chat`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: model || "qwen2.5-coder",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    stream: false
                })
            });

            if (!response.ok) throw new Error(`Ollama responded with status: ${response.status}`);
            const data = await response.json();
            return {
                reviewerType: `Ollama (${model || "qwen2.5-coder"})`,
                summary: data.message?.content || "No review content returned."
            };
        } 
        
        else if (provider === "openai") {
            if (!apiKey) throw new Error("OpenAI API Key is missing.");
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || "gpt-4o",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ]
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `OpenAI status: ${response.status}`);
            }
            const data = await response.json();
            return {
                reviewerType: `OpenAI (${model || "gpt-4o"})`,
                summary: data.choices[0]?.message?.content || "No review content returned."
            };
        } 
        
        else if (provider === "anthropic") {
            if (!apiKey) throw new Error("Claude API Key is missing.");
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                    "dangerously-allow-html": "true"
                },
                body: JSON.stringify({
                    model: model || "claude-3-5-sonnet-20241022",
                    max_tokens: 1024,
                    system: systemPrompt,
                    messages: [
                        { role: "user", content: userPrompt }
                    ]
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `Claude status: ${response.status}`);
            }
            const data = await response.json();
            return {
                reviewerType: `Claude (${model || "claude-3-5-sonnet"})`,
                summary: data.content[0]?.text || "No review content returned."
            };
        } 
        
        else if (provider === "gemini") {
            if (!apiKey) throw new Error("Gemini API Key is missing.");
            const targetModel = model || "gemini-1.5-flash";
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `Gemini status: ${response.status}`);
            }
            const data = await response.json();
            return {
                reviewerType: `Gemini (${targetModel})`,
                summary: data.candidates[0]?.content?.parts[0]?.text || "No review content returned."
            };
        }

        throw new Error(`Unsupported AI Provider: ${provider}`);

    } catch (e) {
        console.error("AI Review connection error: ", e.message);
        return {
            reviewerType: "CodeMesh AI Error",
            summary: `- [SECURITY] Connection failed: unable to reach your AI provider (${provider}).\n` +
                     `- [QUALITY] Error detail: ${e.message || "Unknown network error"}.\n` +
                     `- [STYLE] Please verify that your local Ollama app is running or that your API keys are correct in Settings.`
        };
    }
};
