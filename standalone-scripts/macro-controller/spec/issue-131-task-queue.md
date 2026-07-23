# Spec: Task Queue & Automation Improvements (Issue 131)

This document outlines the design for the Task Queue, customizable delays, retry logic, and SQLite persistence.

## 1. Task Queue Management

### 1.1 Task Structure
Each task in the queue will have:
- `id`: Unique UUID or timestamp-based ID.
- `text`: The prompt text to inject.
- `projectId`: Scoped to a specific project.
- `projectName`: For display and persistence mapping.
- `status`: `pending`, `active`, `completed`, `failed`, `hold`.
- `createdAt`: Timestamp.
- `updatedAt`: Timestamp.
- `retryCount`: Number of times this specific task has been retried.

### 1.2 Persistence Strategy
- **Layer 1 (IndexedDB)**: `ProjectKvStore` (section: `task_queue`). Every change to the queue is saved here immediately to survive reloads.
- **Layer 2 (SQLite)**: `marco.kv` (key: `MacroTaskQueue:{projectId}`). Periodic sync or on-demand save for cross-session project history.

## 2. Automation Engine

### 2.1 Customizable Delay
- Global setting: `nextSubmissionDelaySeconds` (0-120s, default 30s).
- The processor will:
  1. Pick the next `pending` task.
  2. Set status to `active`.
  3. Wait for the configured delay.
  4. Perform injection via `pasteIntoEditor`.
  5. Check for success/failure.

### 2.2 Retry Logic
- Detection: 
  - `pasteIntoEditor` returns `failed`.
  - Specific "Error" or "Limit reached" elements detected via XPath (configurable).
- Action:
  - If `retryOnFailure` is enabled, move task to `hold`.
  - Wait for a "retry delay" (configurable) and move back to `pending`.
  - Max retries: 3 (default).

## 3. UI Components

### 3.1 Settings
- **Timing Tab**:
  - Slider: Next Submission Delay (0-120s).
  - Number field: Credit Poll Interval (default 5s).
  - Toggles: Enable Delay, Retry on Failure.

### 3.2 Task Queue Panel (Hamburger Menu)
- Access via "Task Queue" in the main controller menu.
- Displays:
  - Current status (Running/Paused).
  - Progress bar (N/Total).
  - List of tasks with status icons.
  - Buttons: Pause/Resume, Clear Queue, Retry Failed.

### 3.3 Re-injection Dialog
- On startup, if IndexedDB has `pending` or `hold` tasks, show a toast/modal:
  - "You have 5 pending tasks in the queue. Reinject them?" [Yes] [No/Clear].

## 4. Database Schema (SQLite)
Table: `prompt_communications` (managed via JSON blobs in `marco.kv` for now, or real tables if SDK allows).
Columns:
- `ProjectID`
- `ProjectName`
- `Prompts` (JSON array of task objects)
- `LastUpdated`

## 5. Implementation Roadmap
1. [DONE] Settings Store & UI Expansion.
2. [TODO] Core Queue Engine (`src/queue-control/task-queue.ts`).
3. [TODO] Persistence Layers.
4. [TODO] UI Integration (Menu, Progress, Countdown).
5. [TODO] Bug fixes for Filter/Plan buttons.
