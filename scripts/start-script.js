const fs = require("fs");
const path = require("path");
const os = require("os");

async function main() {
  const input = JSON.parse(fs.readFileSync(0, "utf-8"));
  
  // Use a centralized directory across all projects
  const centralDir = path.join(os.homedir(), ".gemini", "conversation_history");
  if (!fs.existsSync(centralDir)) fs.mkdirSync(centralDir, { recursive: true });
  
  const logPath = path.join(centralDir, "session_log.txt");
  const sessionId = input.session && input.session.id ? input.session.id : "unknown";
  
  const timestamp = new Date().toISOString();
  const logEntry = "[START] " + timestamp + " - Session ID: " + sessionId + " (Project: " + process.cwd() + ")\n";
  fs.appendFileSync(logPath, logEntry);
  
  console.log("{}");
}

main().catch(err => {
  console.error("Error in start-script:", err);
  console.log("{}");
});