use desktop_naotu_lib::mcp::{empty_context, process_line};
use serde_json::Value;
use std::io::{self, BufRead, Write};

fn load_context() -> Value {
    let Ok(raw) = std::env::var("DESKTOP_NAOTU_MCP_CONTEXT") else {
        return empty_context();
    };
    match serde_json::from_str(&raw) {
        Ok(context) => context,
        Err(error) => {
            eprintln!("invalid DESKTOP_NAOTU_MCP_CONTEXT: {error}");
            empty_context()
        }
    }
}

fn main() -> io::Result<()> {
    let context = load_context();
    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    for line in stdin.lock().lines() {
        match line {
            Ok(message) if !message.trim().is_empty() => {
                stdout.write_all(process_line(&message, &context).as_bytes())?;
                stdout.flush()?;
            }
            Ok(_) => {}
            Err(error) => {
                eprintln!("failed reading MCP stdin: {error}");
                break;
            }
        }
    }
    Ok(())
}
