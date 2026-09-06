// === POSA DESKTOP GLOBAL ZOOM HANDLER (100% / 90% / 80%) ===
const ZOOM_BRIDGE_SCRIPT: &str = r#"
(function() {
  if (window.__posa_zoom_initialized) return;
  window.__posa_zoom_initialized = true;

  var KEY = 'posa_zoom_level';
  var saved = localStorage.getItem(KEY);
  var currentZoom = saved ? parseFloat(saved) : 1.0;
  if (isNaN(currentZoom) || currentZoom < 0.8 || currentZoom > 1.0) currentZoom = 1.0;
  document.documentElement.style.zoom = currentZoom;

  window.addEventListener('keydown', function(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      var next = Math.min(1.0, Math.round((currentZoom + 0.1) * 10) / 10);
      if (next !== currentZoom) {
        currentZoom = next;
        document.documentElement.style.zoom = currentZoom;
        localStorage.setItem(KEY, currentZoom);
      }
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      var next = Math.max(0.8, Math.round((currentZoom - 0.1) * 10) / 10);
      if (next !== currentZoom) {
        currentZoom = next;
        document.documentElement.style.zoom = currentZoom;
        localStorage.setItem(KEY, currentZoom);
      }
    } else if (e.key === '0') {
      e.preventDefault();
      if (currentZoom !== 1.0) {
        currentZoom = 1.0;
        document.documentElement.style.zoom = '1';
        localStorage.setItem(KEY, '1');
      }
    }
  });
})();
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .on_page_load(|webview, payload| {
      if payload.event() == tauri::webview::PageLoadEvent::Finished {
        let _ = webview.eval(ZOOM_BRIDGE_SCRIPT);
      }
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
