# Gemini Conversation Tracker Extension

A Gemini CLI Extension that automatically tracks session durations and generates markdown summaries of your conversations.

## How it works
This extension runs globally across all your projects. Every time you start a Gemini CLI session, it logs the start time. When you exit, it captures your session transcript, calculates the duration, and spawns a background process to generate a highly readable Markdown summary of what you discussed. 

All logs and summaries are saved in a `conversation_history/` directory inside whichever project you ran Gemini from.

## Installation

You can install this extension directly from a Git repository! Once you push this code to GitHub, anyone can install it by running:

```bash
gemini extensions install https://github.com/your-username/gemini-conversation-tracker
```

*(Alternatively, to install it locally on your own machine without uploading it, you can run `gemini extensions link .` from inside this folder).*

## Usage
Simply run `gemini` normally. Once you type `exit` or press `Ctrl+C`, the extension will automatically do its work in the background. Check the `conversation_history/` folder for the results!
