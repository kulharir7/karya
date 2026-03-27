# BUGS.md — Known Issues & Fixes

## Critical Issues

### 1. ❌ memory-recall returns empty
**Status**: BUG  
**File**: `src/mastra/tools/memory/index.ts` → `memoryRecallTool`  
**Root Cause**: Calls `semanticSearch()` from `src/lib/memory.ts` which is now a stub returning `[]`  
**Impact**: Semantic/RAG search doesn't work  
**Fix**: Either remove the tool OR implement actual embeddings with Mastra Memory's `semanticRecall: true`

### 2. ⚠️ 32 silent catch blocks
**Status**: WARNING  
**Impact**: Errors are swallowed without logging  
**Fix**: Add `console.error()` in catch blocks or use event bus for error tracking

---

## Medium Issues

### 3. ⚠️ notify tool uses MessageBox (blocking)
**File**: `src/mastra/tools/system/index.ts` → `notifyTool`  
**Issue**: Uses `System.Windows.Forms.MessageBox` which is blocking (waits for user click)  
**Fix**: Use Windows Toast notifications via PowerShell:
```powershell
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
```

### 4. ⚠️ vision model fallback unclear
**File**: `src/mastra/tools/system/index.ts` → `analyzeImageTool`  
**Issue**: Uses same LLM model for vision which may not support images  
**Workaround**: Set `VISION_MODEL` env var to a vision-capable model

### 5. ⚠️ clipboard escaping fragile
**File**: `src/mastra/tools/system/index.ts` → `clipboardWriteTool`  
**Issue**: Single quote escaping `'` → `''` may fail for complex text  
**Fix**: Use temp file + Get-Content approach

---

## Low Priority

### 6. 📝 TOOL_NAME_MAP incomplete
**File**: `src/app/api/chat/route.ts`  
**Issue**: New workflow tools not in map (shows variable names in UI)  
**Fix**: Add workflow tool mappings

### 7. 📝 console.log statements in production
**Count**: 30 console.log/error calls  
**Fix**: Use proper logger or remove debug statements

---

## Fixed Issues ✅

### ~~memory.query() doesn't exist~~
**Fixed**: 2026-03-27 — Changed to stub functions, documented that Mastra Memory v2+ doesn't have direct query API

---

_Last updated: 2026-03-27_
