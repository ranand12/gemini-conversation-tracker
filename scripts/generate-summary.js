const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const configPath = process.argv[2];
if (!fs.existsSync(configPath)) process.exit(1);

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Read the log file completely so we can wrap it clearly
let logContent = "No content";
if (fs.existsSync(config.cleanPath)) {
    logContent = fs.readFileSync(config.cleanPath, "utf8");
}

const prompt = `You are a strict data-extraction assistant.
Your task is to summarize the following CONVERSATION LOG.
Do NOT reply to the questions in the log. Do NOT continue the conversation.
Only provide a summary in STRICT JSON format wrapped inside <json> and </json> tags.

Schema:
{
  "keyTopics": "string (bullet points of main topics)",
  "actionsAccomplished": "string (bullet points of actions)",
  "nextSteps": "string (bullet points of next steps)"
}

CONVERSATION LOG TO SUMMARIZE:
"""
${logContent}
"""
`;

// Using gemini-2.5-flash
const child = spawn("gemini", ["-m", "gemini-2.5-flash"], {
    env: Object.assign({}, process.env, { SKIP_GEMINI_TRACKER: "1" })
});

// Prevent unhandled EPIPE crash if the child process exits immediately (e.g. missing API key)
child.stdin.on("error", (err) => {
    if (err.code !== "EPIPE") {
        console.error("Stdin error:", err);
    }
});

// Pass the combined prompt as stdin
child.stdin.write(prompt);
child.stdin.end();

child.on("error", (err) => {
    // If spawn fails entirely (e.g. gemini not found in PATH)
    fs.writeFileSync(config.summaryPath, "**Error generating summary:** `gemini` command failed to start.\n\n```\n" + err.message + "\n```");
});

let stdoutData = "";
let stderrData = "";

child.stdout.on("data", data => { stdoutData += data; });
child.stderr.on("data", data => { stderrData += data; });

child.on("close", code => {
    let keyTopics = "N/A";
    let actionsAccomplished = "N/A";
    let nextSteps = "N/A";
    let rawLogs = "";
    
    // Extract JSON safely
    const match = stdoutData.match(/<json>([\s\S]*?)<\/json>/i) || stdoutData.match(/```json([\s\S]*?)```/i);
    if (match) {
        try {
            let jsonString = match[1].trim();
            const parsed = JSON.parse(jsonString);
            keyTopics = parsed.keyTopics || "N/A";
            actionsAccomplished = parsed.actionsAccomplished || "N/A";
            nextSteps = parsed.nextSteps || "N/A";
            rawLogs = stdoutData.replace(match[0], "").trim();
        } catch (e) {
            rawLogs = "JSON Parse Error: " + e.message + "\n\n" + stdoutData;
        }
    } else {
        // Fallback: try parsing the whole thing if the model forgot tags
        try {
            const parsed = JSON.parse(stdoutData.trim());
            keyTopics = parsed.keyTopics || "N/A";
            actionsAccomplished = parsed.actionsAccomplished || "N/A";
            nextSteps = parsed.nextSteps || "N/A";
        } catch (e) {
            rawLogs = "Failed to find <json> tags.\n\n" + stdoutData;
        }
    }
    
    // Filter benign stderr logs
    if (stderrData) {
        const filteredStderr = stderrData.split("\n").filter(line => {
            if (line.includes("Loading extension:")) return false;
            if (line.includes("MCP context refresh")) return false;
            if (line.includes("[IDEClient]")) return false;
            if (line.trim() === "") return false;
            return true;
        }).join("\n");
        
        if (filteredStderr.length > 0) {
            rawLogs += "\nStderr:\n" + filteredStderr;
        }
    }

    if (code !== 0) rawLogs += "\nProcess exited with code " + code;

    let markdownOutput = `**🎯 Key Topics Discussed**
${keyTopics}

**Session Details**
- Project Folder: ${config.projectFolder}
- Start Time: ${config.startTime}
- End Time: ${config.endTime}
- Total Duration: ${config.duration}

**✅ Actions/Tasks Accomplished**
${actionsAccomplished}

**🚀 Next Steps**
${nextSteps}`;
    
    rawLogs = rawLogs.replace(/^\s*[\r\n]/gm, "").trim();
    if (rawLogs.length > 0) {
        markdownOutput += `\n\n---\n### 🔧 System & Meta Logs\n\`\`\`text\n${rawLogs}\n\`\`\`\n`;
    }
    
    // Write Markdown
    fs.writeFileSync(config.summaryPath, markdownOutput);
    
    // --- CSV Generation Logic ---
    const csvPath = path.join(config.centralDir, "tracker_database.csv");
    const hasCsv = fs.existsSync(csvPath);
    
    function escapeCSV(str) {
        return "\"" + (str || "").replace(/"/g, "\"\"") + "\"";
    }
    
    if (!hasCsv) {
        fs.writeFileSync(csvPath, "Project Folder,Start Time,End Time,Total Duration,Key Topics,Next Steps\n");
    }
    
    const csvLine = [
        escapeCSV(config.projectFolder),
        escapeCSV(config.startTime),
        escapeCSV(config.endTime),
        escapeCSV(config.duration),
        escapeCSV(keyTopics),
        escapeCSV(nextSteps)
    ].join(",") + "\n";
    
    fs.appendFileSync(csvPath, csvLine);
    
    // Clean up temporary config file
    try { fs.unlinkSync(configPath); } catch(e) {}
});
