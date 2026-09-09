# Performance adapter

ReleaseTruth's performance surface is intentionally lightweight. It summarizes repeated real measurements using sorted samples, min/max/mean, p50, and p95 when at least five samples exist.

The default classifier marks a numeric increase significant when it exceeds the configured regression percentage (25% by default). Machine noise, cold starts, network variance, and shared CI hosts can dominate small differences; stable environments and repeated samples are required for trustworthy gates.

ReleaseTruth is not a load-testing replacement. Use a dedicated load tool for concurrency, saturation, throughput, and capacity planning.
