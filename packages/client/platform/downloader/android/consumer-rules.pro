-keep class org.deltacomic.downloader.** { *; }

# Headless workers load Tauri's generated bridge before any Activity is created.
-keep class **.Rust { *; }
