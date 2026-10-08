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

## Disclaimer

This repository and its contents are provided for illustration and educational purposes only as example code. This is not an official Google product or officially supported Google Cloud project. This code is provided as-is for demonstration purposes and is NOT intended or supported for production workloads. The views, code, and opinions expressed in this repository are those of the author(s) and do not necessarily reflect the position, opinions, or official policy of Google LLC or Google Cloud Platform.
