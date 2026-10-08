
# Published payloads

Exact `create_article` payloads as published, committed so the series is
reproducible and survives a reboot. Republish one:

```bash
slug=n8n-three-agents-explained
base64 -w0 "content/n8n/drafts/$slug.json" \
  | xargs -I{} gh workflow run publish-article.yml -f payload_b64={} -f mode=publish
```
