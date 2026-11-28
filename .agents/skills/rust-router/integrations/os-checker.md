# OS-Checker Integration

> 代码审查和安全审计工具集成

## Available Commands

| Use Case | Command | Tools |
|----------|---------|-------|
| Daily check | `/rust-review` | clippy |
| Security audit | `/audit security` | cargo audit, geiger |
| Unsafe audit | `/audit safety` | miri, rudra |
| Concurrency audit | `/audit concurrency` | lockbud |
| Full audit | `/audit full` | all os-checker tools |

## When to Suggest OS-Checker

| User Intent | Suggest |
|-------------|---------|
| Code review request | `/rust-review` |
| Security concerns | `/audit security` |
| Unsafe code review | `/audit safety` |
| Deadlock/race concerns | `/audit concurrency` |
| Pre-release check | `/audit full` |

## Tool Descriptions

### clippy
Standard Rust linter for code style and common mistakes.

### cargo audit
Security vulnerability scanner for dependencies.

### geiger
Counts unsafe code usage in dependencies.

### miri
Interprets MIR to detect undefined behavior.

### rudra
Memory safety bug detector.

### lockbud
Deadlock and concurrency bug detector.

## Integration Flow

```
User: "Review my unsafe code"
     │
     ▼
Router detects: unsafe + review
     │
     ├── Load: unsafe-checker skill (for manual review)
     │
     └── Suggest: `/audit safety` (for automated check)
```
