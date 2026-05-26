---
'@backstage/plugin-scaffolder-backend': patch
---

**BREAKING** This change alters the bucket boundaries of the `scaffolder.task.duration` and `scaffolder.step.duration` OpenTelemetry histogram metrics. If you have dashboards or alerts that depend on specific bucket label values (e.g. `le="5"`) for these metrics, they will need to be updated.

Previously these metrics used OpenTelemetry's default bucket boundaries, which are calibrated for milliseconds. Since the metrics record values in seconds, all typical task and step durations were crammed into the first few buckets, making percentile calculations (p50, p95, p99) unreliable. Explicit second-scale boundaries are now used to produce accurate distributions.
