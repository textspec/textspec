---
"@textspec/notation": patch
---

fix: escape `"` in serialized text content

Literal `"` in block content now serializes as `\"` so it round-trips through `parse`. Previously the serializer emitted `"` literally, but the parser treats unescaped `"` as the start of an attribute string, silently consuming surrounding text or erroring on an unbalanced quote.
