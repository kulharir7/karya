/**
 * Next.js Instrumentation — Server startup hooks
 * 
 * This runs once when the server starts.
 * Use for initializing background services.
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[karya] Server starting...");
    
    // Start WebSocket server
    const { startWebSocketServer } = await import("./lib/websocket-server");
    startWebSocketServer();
    
    // Initialize scheduler (resume active tasks)
    const { initScheduler } = await import("./lib/scheduler");
    await initScheduler();
    
    console.log("[karya] Background services initialized");
  }
}
