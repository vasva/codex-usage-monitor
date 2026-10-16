# Codex Usage Monitor

A small Visual Studio Code extension that shows the remaining Codex usage in the status bar and its tooltip.

## Requirements

- Visual Studio Code 1.90 or later
- The official OpenAI Codex VS Code extension

## How it works

The extension locates the Codex executable bundled with the OpenAI extension and starts its app server over standard input and output. It requests the account rate limits and displays the five-hour and weekly windows. The extension source does not make direct HTTP requests.

The extension does not read Codex session transcripts. The account rate-limit request is handled by the Codex app server.

## Install from source

1. Clone this repository.
2. Open the folder in Visual Studio Code.
3. Press `F5` to launch an Extension Development Host.

## Development

The extension is implemented in `extension.js` and `usageClient.js`. The VS Code launch configuration is in `.vscode/launch.json`.

## License

No license has been selected yet.
