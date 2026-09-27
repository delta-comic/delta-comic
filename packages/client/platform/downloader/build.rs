const COMMANDS: &[&str] = &[
  "cancel_task",
  "delete_task_files",
  "delete_secret",
  "download_ephemeral",
  "enqueue_plan",
  "enqueue_torrent",
  "enqueue_url",
  "forget_task",
  "get_collections",
  "get_capabilities",
  "get_settings",
  "get_task",
  "get_task_detail",
  "list_destinations",
  "list_tasks",
  "move_queue",
  "pause_task",
  "pick_destination",
  "resume_task",
  "retry_task",
  "set_priority",
  "store_secret",
  "update_settings",
  "update_source",
];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .build();
}
