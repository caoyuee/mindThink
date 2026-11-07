use desktop_naotu_lib::mcp::empty_context;
use desktop_naotu_lib::mcp_http::serve_connection;
use serde_json::Value;
use std::io;
use std::net::TcpListener;

fn load_context() -> Value {
    std::env::var("DESKTOP_NAOTU_MCP_CONTEXT")
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_else(empty_context)
}

fn main() -> io::Result<()> {
    let port = std::env::var("DESKTOP_NAOTU_MCP_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8765);
    let listener = TcpListener::bind(("127.0.0.1", port))?;
    eprintln!("DesktopNaotu MCP HTTP listening on http://127.0.0.1:{port}/mcp");
    let context = load_context();
    for connection in listener.incoming() {
        match connection {
            Ok(stream) => {
                if let Err(error) = serve_connection(stream, &context) {
                    eprintln!("MCP HTTP connection failed: {error}");
                }
            }
            Err(error) => eprintln!("MCP HTTP accept failed: {error}"),
        }
    }
    Ok(())
}
