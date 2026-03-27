/**
 * Example Karya Plugin
 * 
 * This shows how to create a custom plugin with:
 * - Custom tools
 * - Event hooks
 * - Middleware
 * 
 * To use:
 * 1. Copy this file to plugins/
 * 2. Import and call .register() in your code
 * 3. Or load dynamically via API
 */

import { createPlugin, Middleware } from "../src/lib/plugin-api";
import { z } from "zod";

// Create the plugin
const myPlugin = createPlugin({
  id: "my-awesome-plugin",
  name: "My Awesome Plugin",
  version: "1.0.0",
  description: "An example plugin showing all features",
  author: "Your Name",
})

// Add a custom tool
.tool({
  id: "greet-user",
  description: "Greet a user with a custom message",
  inputSchema: z.object({
    name: z.string().describe("User's name"),
    language: z.enum(["en", "hi", "es"]).default("en").describe("Language"),
  }),
  execute: async ({ name, language }) => {
    const greetings: Record<string, string> = {
      en: `Hello, ${name}! How are you today?`,
      hi: `नमस्ते, ${name}! आप कैसे हैं?`,
      es: `¡Hola, ${name}! ¿Cómo estás?`,
    };
    return {
      greeting: greetings[language] || greetings.en,
      language,
    };
  },
})

// Add another tool
.tool({
  id: "calculate-age",
  description: "Calculate age from birth year",
  inputSchema: z.object({
    birthYear: z.number().describe("Year of birth"),
  }),
  execute: async ({ birthYear }) => {
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;
    return {
      birthYear,
      currentYear,
      age,
      message: `You are ${age} years old.`,
    };
  },
})

// Hook into tool calls
.on("tool:before_call", (data, ctx) => {
  ctx.log(`[my-plugin] Tool starting: ${data.tool}`);
})

.on("tool:after_call", (data, ctx) => {
  ctx.log(`[my-plugin] Tool completed: ${data.tool}`);
})

// Hook into agent lifecycle
.on("agent:start", (data, ctx) => {
  ctx.log(`[my-plugin] Agent started for session: ${data.sessionId}`);
})

.on("agent:end", (data, ctx) => {
  ctx.log(`[my-plugin] Agent finished`);
});

// Export for registration
export default myPlugin;

// Alternative: Auto-register on import
// myPlugin.register();
