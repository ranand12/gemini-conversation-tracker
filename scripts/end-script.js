const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

async function main() {
  const input = JSON.parse(fs.readFileSync(0, "utf-8"));
  
  // Use a centralized directory across all projects
  const centralDir = path.join(os.homedir(), ".gemini", "conversation_history");
  if (!fs.existsSync(centralDir)) fs.mkdirSync(centralDir, { recursive: true });
  
  const logPath = path.join(centralDir, "session_log.txt");
  
  const endTimestamp = new Date().toISOString();
  fs.appendFileSync(logPath, "[END] " + endTimestamp + " (Project: " + process.cwd() + ")\n");
  
  if (input.transcript_path && fs.existsSync(input.transcript_path)) {
    let transcript;
    try {
        transcript = JSON.parse(fs.readFileSync(input.transcript_path, "utf-8"));
    } catch (e) {
        fs.appendFileSync(logPath, "[ERR] Failed to parse transcript: " + e.message + "\n");
        return;
    }
    
    const sessionId = transcript.sessionId || "unknown";
    const shortSessionId = sessionId !== "unknown" ? sessionId.substring(0, 8) : "unknown";
    
    const startT = transcript.startTime ? new Date(transcript.startTime) : new Date();
    const filePrefix = startT.toISOString().substring(0, 19).replace(/:/g, "-") + "_" + shortSessionId;
    
    // Save files in the central directory
    const rawPath = path.join(centralDir, filePrefix + "_raw.json");
    const cleanPath = path.join(centralDir, filePrefix + "_clean.txt");
    const summaryPath = path.join(centralDir, filePrefix + "_summary.md");
    const configPath = path.join(centralDir, filePrefix + "_config.json");
    
    fs.copyFileSync(input.transcript_path, rawPath);
    
    if (process.env.SKIP_GEMINI_TRACKER) {
      return; 
    }
    
    if (fs.existsSync(summaryPath)) {
        const stats = fs.statSync(summaryPath);
        const ageMs = Date.now() - stats.mtimeMs;
        if (ageMs < 10000) {
            fs.appendFileSync(logPath, "[SKIP] Summary already generated within the last 10s.\n");
            return;
        }
    }

    try {
      const endT = transcript.lastUpdated ? new Date(transcript.lastUpdated) : new Date(endTimestamp);
      const durationMs = Math.abs(endT - startT);
      
      const minutes = Math.floor(durationMs / 60000);
      const seconds = ((durationMs % 60000) / 1000).toFixed(0);
      const durationStr = minutes > 0 ? minutes + "m " + seconds + "s" : seconds + "s";
      
      const timeFormatOptions = { 
        weekday: "long", year: "numeric", month: "long", day: "numeric", 
        hour: "numeric", minute: "2-digit", timeZoneName: "short" 
      };
      
      const startStr = startT.toLocaleString(undefined, timeFormatOptions);
      const endStr = endT.toLocaleString(undefined, timeFormatOptions);
      
      let cleanChat = "Session Meta:\n- Start Time: " + startStr + "\n- End Time: " + endStr + "\n- Total Duration: " + durationStr + "\n- Project: " + process.cwd() + "\n\n";
      
      if (transcript.messages) {
         for (const msg of transcript.messages) {
            let text = "";
            if (typeof msg.content === "string") {
                text = msg.content;
            } else if (Array.isArray(msg.content)) {
                text = msg.content.filter(p => p.text).map(p => p.text).join("\n");
            }
            if (text.trim()) {
                cleanChat += "\n\n=== " + (msg.type || "unknown").toUpperCase() + " ===\n" + text + "\n";
            }
         }
      }
      fs.writeFileSync(cleanPath, cleanChat || "No chat history found.");
      fs.writeFileSync(summaryPath, "Generating summary...");
      
      // Write config parameters for the generate-summary script
      fs.writeFileSync(configPath, JSON.stringify({
          centralDir: centralDir,
          projectFolder: process.cwd(),
          startTime: startStr,
          endTime: endStr,
          duration: durationStr,
          cleanPath: cleanPath,
          summaryPath: summaryPath
      }));
      
    } catch (e) {
      fs.appendFileSync(logPath, "[ERR] Failed to extract clean text: " + e.message + "\n");
      return;
    }
    
    const generatorScript = path.join(__dirname, "generate-summary.js");
    
    // Spawn the background processor
    const child = spawn("node", [generatorScript, configPath], {
        detached: true,
        stdio: "ignore",
    });
    child.unref();
  }
}

main().catch(err => {
  console.error("Error in end-script:", err);
});