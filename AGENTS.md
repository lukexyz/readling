# Readling working agreements

- When the user asks to push Readling to GitHub `main`, treat that request as authorization to publish the same commit to Readling’s existing public ChatGPT Site. After the push succeeds, deploy the exact GitHub `main` commit in the same task using the Sites project in `.openai/hosting.json`. Verify the live deployment and report its URL and commit. If publication fails, say which commit reached GitHub and what blocked the site update. An explicit request to push only or skip deployment takes precedence.
- Never add Codex, OpenAI, an AI assistant, or any automated tool as a commit or pull-request co-author. Never add `Co-authored-by` trailers for them.
