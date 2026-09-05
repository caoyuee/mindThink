use crate::mcp::handle_rpc;
use serde_json::Value;
use std::io::{self, Read, Write};
use std::net::TcpStream;
use std::time::Duration;

const MAX_HEADER_BYTES: usize = 16 * 1024;
const MAX_BODY_BYTES: usize = 1024 * 1024;

pub fn serve_connection(mut stream: TcpStream, context: &Value) -> io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(10)))?;
    stream.set_write_timeout(Some(Duration::from_secs(10)))?;
    let response = match read_request(&mut stream) {
        Ok(body) => match serde_json::from_slice::<Value>(&body) {
            Ok(request) => http_response(200, "OK", &handle_rpc(request, context.clone()).to_string()),
            Err(error) => http_response(
                400,
                "Bad Request",
                &serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": null,
                    "error": { "code": -32700, "message": format!("MCP 消息不是有效 JSON: {error}") }
                })
                .to_string(),
            ),
        },
        Err(error) => http_response(error.status, error.reason, &error.body),
    };
    stream.write_all(response.as_bytes())?;
    stream.flush()
}

struct HttpError {
    status: u16,
    reason: &'static str,
    body: String,
}

fn read_request(stream: &mut TcpStream) -> Result<Vec<u8>, HttpError> {
    let mut data = Vec::new();
    let mut buffer = [0_u8; 4096];
    let header_end = loop {
        let count = stream.read(&mut buffer).map_err(internal_error)?;
        if count == 0 {
            return Err(bad_request("请求头不完整"));
        }
        data.extend_from_slice(&buffer[..count]);
        if data.len() > MAX_HEADER_BYTES {
            return Err(HttpError {
                status: 431,
                reason: "Request Header Fields Too Large",
                body: "请求头过大".to_string(),
            });
        }
        if let Some(index) = data.windows(4).position(|window| window == b"\r\n\r\n") {
            break index + 4;
        }
    };
    let headers =
        std::str::from_utf8(&data[..header_end]).map_err(|_| bad_request("请求头必须是 UTF-8"))?;
    let mut lines = headers.split("\r\n");
    if lines.next() != Some("POST /mcp HTTP/1.1") {
        return Err(HttpError {
            status: 404,
            reason: "Not Found",
            body: "仅支持 POST /mcp".to_string(),
        });
    }
    let content_length = lines
        .find_map(|line| {
            line.split_once(':')
                .filter(|(name, _)| name.eq_ignore_ascii_case("content-length"))
        })
        .and_then(|(_, value)| value.trim().parse::<usize>().ok())
        .ok_or_else(|| bad_request("缺少有效 Content-Length"))?;
    if content_length > MAX_BODY_BYTES {
        return Err(HttpError {
            status: 413,
            reason: "Content Too Large",
            body: "请求体超过 1 MiB".to_string(),
        });
    }
    while data.len() - header_end < content_length {
        let count = stream.read(&mut buffer).map_err(internal_error)?;
        if count == 0 {
            return Err(bad_request("请求体不完整"));
        }
        data.extend_from_slice(&buffer[..count]);
    }
    Ok(data[header_end..header_end + content_length].to_vec())
}

fn http_response(status: u16, reason: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nAccess-Control-Allow-Origin: null\r\n\r\n{body}",
        body.len()
    )
}

fn bad_request(message: &str) -> HttpError {
    HttpError {
        status: 400,
        reason: "Bad Request",
        body: message.to_string(),
    }
}

fn internal_error(error: io::Error) -> HttpError {
    HttpError {
        status: 500,
        reason: "Internal Server Error",
        body: error.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::serve_connection;
    use crate::mcp::empty_context;
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    fn exchange(request: String) -> String {
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("bind test listener");
        let address = listener.local_addr().expect("read listener address");
        let server = thread::spawn(move || {
            let (stream, _) = listener.accept().expect("accept test connection");
            serve_connection(stream, &empty_context()).expect("serve test connection");
        });
        let mut client = TcpStream::connect(address).expect("connect test client");
        client
            .write_all(request.as_bytes())
            .expect("write test request");
        client
            .shutdown(std::net::Shutdown::Write)
            .expect("finish request");
        let mut response = String::new();
        client
            .read_to_string(&mut response)
            .expect("read test response");
        server.join().expect("join test server");
        response
    }

    #[test]
    fn serves_json_rpc_over_http() {
        let body = r#"{"jsonrpc":"2.0","id":1,"method":"initialize"}"#;
        let response = exchange(format!(
            "POST /mcp HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: {}\r\n\r\n{body}",
            body.len()
        ));
        assert!(response.starts_with("HTTP/1.1 200 OK"));
        assert!(response.contains("2024-11-05"));
    }

    #[test]
    fn rejects_non_mcp_routes() {
        let response =
            exchange("GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 0\r\n\r\n".to_string());
        assert!(response.starts_with("HTTP/1.1 404 Not Found"));
    }
}
