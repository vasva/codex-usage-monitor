# bm.Codex Usage Monitor

Projects page: [WESTBOHEMIA.COM](https://www.westbohemia.com/developer/en/index.html).

A small Visual Studio Code extension that shows the remaining Codex usage in the status bar and its tooltip.

![Codex usage tooltip and status bar indicator in Visual Studio Code](https://www.westbohemia.com/developer/codex-usage-monitor/assets/codex-usage-monitor-overview.png)

## Requirements

- Visual Studio Code 1.90 or later
- The official OpenAI Codex VS Code extension

## How it works

The extension locates the Codex executable bundled with the OpenAI extension and starts its app server over standard input and output. It requests the account rate limits and displays the five-hour and weekly windows. The extension source does not make direct HTTP requests.

The extension does not read Codex session transcripts. The account rate-limit request is handled by the Codex app server.

## License

The project is free and open source under the MIT License.
