/**
 * Mock AI review service that analyzes snippets and returns suggestions.
 */
export const performAIReview = (title, language, code) => {
    const findings = [];
    const lowerCode = code.toLowerCase();

    // 1. Check for hardcoded credentials
    if (lowerCode.includes("password =") || lowerCode.includes("api_key =") || lowerCode.includes("secret =")) {
        findings.push("- [SECURITY] Avoid hardcoded secrets or API keys in code snippets.");
    }

    // 2. Check for unsafe practices
    if (lowerCode.includes("eval(")) {
        findings.push("- [SECURITY] Unsafe execution pattern detected: avoid using eval().");
    }

    // 3. Language-specific recommendations
    if (language === 'javascript' || language === 'typescript') {
        if (!lowerCode.includes("const ") && !lowerCode.includes("let ")) {
            findings.push("- [STYLE] Use modern variable declarations (const, let) instead of var.");
        }
    }

    if (findings.length === 0) {
        findings.push("- [QUALITY] No critical issues found! Style looks clean.");
    }

    return {
        reviewerType: "CodeMesh-GPT-v1",
        summary: `AI Review for "${title}":\n\n` + findings.join("\n")
    };
};
