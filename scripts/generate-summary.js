const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const configPath = process.argv[2];
if (!fs.existsSync(configPath)) process.exit(1);

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const prompt = `You are summarizing a conversation between a USER and an AI MODEL.
Please provide a summary in strictly valid JSON format. Wrap your JSON inside <json> and </json> tags. DO NOT output ANY conversational filler. Just output the raw <json> block.
Schema:
{
  "keyTopics": "string (bullet points of main topics)",
  "actionsAccomplished": "string (bullet points of actions)",
  "nextSteps": "string (bullet points of next steps)"
}`;

// Using gemini-3.1-flash as requested
const child = spawn("gemini", ["-m", "gemini-2.5-flash", "-p", prompt], {
    env: Object.assign({}, process.env, { SKIP_GEMINI_TRACKER: "1" })
});

const inputStream = fs.createReadStream(config.cleanPath);
inputStream.pipe(child.stdin);

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
    const match = stdoutData.match(/<json>([\s\S]*?)<\/json>/i);
    if (match) {
        try {
            // Strip markdown JSON wrappers if the model included them inside the tag
            let jsonString = match[1].trim();
            jsonString = jsonString.replace(/^\s*\`\`\`json/i, "").replace(/\`\`\`\s*$/i, "").trim();
            
            const parsed = JSON.parse(jsonString);
            keyTopics = parsed.keyTopics || "N/A";
            actionsAccomplished = parsed.actionsAccomplished || "N/A";
            nextSteps = parsed.nextSteps || "N/A";
            rawLogs = stdoutData.replace(match[0], "").trim();
        } catch (e) {
            rawLogs = "JSON Parse Error: " + e.message + "\n\n" + stdoutData;
        }
    } else {
        rawLogs = "Failed to find <json> tags.\n\n" + stdoutData;
    }
    
    if (code !== 0) rawLogs += `\nProcess exited with code ${code}`;
    if (stderrData) rawLogs += `\nStderr:\n${stderrData}`;

    let markdownOutput = `**🎯 Key Topics Discussed**\n${keyTopics}\n\n**Session Details**\n- Project Folder: ${config.projectFolder}\n- Start Time: ${config.startTime}\n- End Time: ${config.endTime}\n- Total Duration: ${config.duration}\n\n**✅ Actions/Tasks Accomplished**\n${actionsAccomplished}\n\n**🚀 Next Steps**\n${nextSteps}`;
    
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
