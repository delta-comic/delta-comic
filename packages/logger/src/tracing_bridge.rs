use std::{fmt, sync::Once};

use tracing::{Event, Subscriber, field::Visit};
use tracing_log::LogTracer;
use tracing_subscriber::{
  EnvFilter, Layer, filter::LevelFilter, layer::SubscriberExt, util::SubscriberInitExt,
};

use crate::{
  error::{Error, Result},
  model::{LogLevel, LogRecord},
  storage::LoggerHandle,
};

pub(crate) struct TracingBridge {
  handle: LoggerHandle,
}

impl TracingBridge {
  pub(crate) fn install(handle: LoggerHandle) -> Result<()> {
    if let Err(error) = LogTracer::init() {
      eprintln!("logger could not install the log-to-tracing bridge: {error}");
    }
    let filter = build_filter();
    tracing_subscriber::registry()
      .with(filter)
      .with(Self { handle })
      .try_init()
      .map_err(|error| Error::Initialization(error.to_string()))
  }
}

impl<S> Layer<S> for TracingBridge
where
  S: Subscriber,
{
  fn on_event(&self, event: &Event<'_>, _context: tracing_subscriber::layer::Context<'_, S>) {
    let metadata = event.metadata();
    let mut visitor = EventVisitor::default();
    event.record(&mut visitor);
    let scope = visitor
      .scope
      .take()
      .unwrap_or_else(|| metadata.target().to_owned());
    let content = visitor.into_content();
    self.handle.try_record(LogRecord::new(
      scope,
      LogLevel::from(metadata.level()),
      content,
    ));
  }
}

fn build_filter() -> EnvFilter {
  #[cfg(debug_assertions)]
  {
    EnvFilter::builder()
      .with_default_directive(LevelFilter::TRACE.into())
      .from_env_lossy()
  }
  #[cfg(not(debug_assertions))]
  {
    // Production builds never accept an environment override below `info`.
    EnvFilter::builder()
      .with_default_directive(LevelFilter::INFO.into())
      .parse_lossy("info")
  }
}

#[derive(Default)]
struct EventVisitor {
  message: Option<String>,
  scope: Option<String>,
  fields: Vec<String>,
}

impl EventVisitor {
  fn into_content(self) -> String {
    match (self.message, self.fields.is_empty()) {
      (Some(message), true) => message,
      (Some(message), false) => format!("{message} {}", self.fields.join(" ")),
      (None, _) => self.fields.join(" "),
    }
  }

  fn record_value(&mut self, field: &tracing::field::Field, value: String) {
    match field.name() {
      "message" => self.message = Some(value),
      "scope" => self.scope = Some(value),
      name if name.starts_with("log.") => {}
      name => self.fields.push(format!("{name}={value}")),
    }
  }
}

impl Visit for EventVisitor {
  fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn fmt::Debug) {
    self.record_value(field, format!("{value:?}"));
  }

  fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
    self.record_value(field, value.to_owned());
  }

  fn record_error(
    &mut self,
    field: &tracing::field::Field,
    value: &(dyn std::error::Error + 'static),
  ) {
    self.record_value(field, value.to_string());
  }
}

pub(crate) struct PanicCapture;

impl PanicCapture {
  pub(crate) fn install(handle: LoggerHandle) {
    static INSTALL: Once = Once::new();
    INSTALL.call_once(move || {
      let previous = std::panic::take_hook();
      std::panic::set_hook(Box::new(move |panic| {
        let payload = panic
          .payload()
          .downcast_ref::<&str>()
          .copied()
          .or_else(|| panic.payload().downcast_ref::<String>().map(String::as_str))
          .unwrap_or("non-string panic payload");
        let location = panic
          .location()
          .map(|location| {
            format!(
              "{}:{}:{}",
              location.file(),
              location.line(),
              location.column()
            )
          })
          .unwrap_or_else(|| "unknown location".to_owned());
        handle.try_record(LogRecord::new(
          "panic",
          LogLevel::Error,
          format!("panic at {location}: {payload}"),
        ));
        previous(panic);
      }));
    });
  }
}

#[cfg(test)]
mod tests {
  use super::EventVisitor;

  #[test]
  fn event_visitor_separates_scope_message_and_structured_fields() {
    let visitor = EventVisitor {
      message: Some("download started".into()),
      scope: Some("downloader".into()),
      fields: vec!["task=42".into()],
    };
    assert_eq!(visitor.scope.as_deref(), Some("downloader"));
    assert_eq!(visitor.into_content(), "download started task=42");
  }
}
