import "dotenv/config";
import { mastra } from "./mastra";

async function main() {
  const agent = mastra.getAgent("karya");

  console.log("🔥 Karya AI Computer Agent — Test Mode");
  console.log("======================================\n");

  // Test 1: System Info
  console.log("📋 Test 1: System Info...");
  const result1 = await agent.generate(
    "Mera system info batao — OS, CPU, RAM, username sab"
  );
  console.log("Result:", result1.text);
  console.log("\n---\n");

  // Test 2: List Files
  console.log("📁 Test 2: List files on Desktop...");
  const result2 = await agent.generate(
    "Mere Desktop pe kya kya files hain? List karo"
  );
  console.log("Result:", result2.text);
  console.log("\n---\n");

  // Test 3: Write File
  console.log("📝 Test 3: Create a test file...");
  const result3 = await agent.generate(
    "F:\\karya\\test-output.txt mein likh do: 'Karya AI is alive! 🔥 First test successful.'"
  );
  console.log("Result:", result3.text);
  console.log("\n---\n");

  console.log("✅ All tests complete!");
}

main().catch(console.error);
