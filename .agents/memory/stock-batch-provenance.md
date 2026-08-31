---
name: Stock-batch provenance
description: How to handle FIFO batch attribution when opening stock and absolute adjustments make historical provenance ambiguous.
---

Use FIFO for dated stock-in batches only while provenance is defensible. Opening stock and returns remain unattributed, and every absolute stock correction resets all surviving pre-correction stock into an unattributed pool before later sales are allocated.

**Why:** An absolute stock adjustment records the resulting quantity, not where those units came from. Treating every gap as a new dated batch—or ignoring possible opening stock—can produce confident but false “sold from this restock” figures.

**How to apply:** Any report or UI that allocates OUT movements to IN events must preserve ambiguous quantities as opening, returned, or corrected stock. Never count a correction as a sale or use it to assert which earlier batch survived.