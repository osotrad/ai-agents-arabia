# LangChain series — unpublished drafts

Exact `create_article` payloads for the parts of the series not yet live.
Committed so the queue survives a reboot: these are the source of truth for
`gh workflow run publish-article.yml`, not `/tmp`.

Republish one:

```bash
slug=langgraph-workflows-and-interrupts
base64 -w0 "content/langchain/drafts/$slug.json" \
  | xargs -I{} gh workflow run publish-article.yml -f payload_b64={} -f mode=publish
```

`status` is `pending_review` in each file. The daily publish cap
(`DAILY_PUBLISH_CAP`, a repo variable) gates publication — a 429 here means
the rolling-24h window is full, not that the payload is wrong.
