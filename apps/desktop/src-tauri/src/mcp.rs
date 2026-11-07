use serde_json::{json, Value};

pub fn empty_context() -> Value {
    json!({
        "tools": [],
        "resources": [
            { "uri": "mindmap://current", "name": "Current mindmap", "mimeType": "text/markdown" }
        ],
        "current": { "title": "Untitled", "markdown": "- Untitled\n", "nodeCount": 1 },
        "nodes": {}
    })
}

pub fn handle_rpc(request: Value, context: Value) -> Value {
    let Some(object) = request.as_object() else {
        return rpc_error(Value::Null, -32600, "MCP 请求必须是对象");
    };
    let id = object.get("id").cloned().unwrap_or(Value::Null);
    if object.get("jsonrpc").and_then(Value::as_str) != Some("2.0") {
        return rpc_error(id, -32600, "MCP RPC 请求格式无效");
    }
    let Some(method) = object.get("method").and_then(Value::as_str) else {
        return rpc_error(id, -32600, "MCP RPC 缺少 method");
    };
    let result = match method {
        "initialize" => Some(json!({
            "protocolVersion": "2024-11-05",
            "serverInfo": { "name": "DesktopNaotu", "version": "0.1.0" },
            "capabilities": { "resources": {}, "tools": {} }
        })),
        "tools/list" => context
            .get("tools")
            .cloned()
            .map(|tools| json!({ "tools": tools })),
        "resources/list" => context
            .get("resources")
            .cloned()
            .map(|resources| json!({ "resources": resources })),
        "resources/read" => read_resource(object, &context),
        "tools/call" => tool_call(object, &id),
        _ => return rpc_error(id, -32601, &format!("不支持的 MCP 方法: {method}")),
    };
    result.map_or_else(
        || rpc_error(id.clone(), -32602, "MCP 资源或上下文参数无效"),
        |value| json!({ "jsonrpc": "2.0", "id": id, "result": value }),
    )
}

fn read_resource(object: &serde_json::Map<String, Value>, context: &Value) -> Option<Value> {
    let uri = object.get("params")?.get("uri")?.as_str()?;
    if uri == "mindmap://current" {
        return context.get("current")?.get("markdown").cloned().map(|text| {
            json!({ "contents": [{ "uri": uri, "mimeType": "text/markdown", "text": text }] })
        });
    }
    let node_id = uri.strip_prefix("mindmap://node/")?;
    context.get("nodes")?.get(node_id).map(|node| {
        json!({ "contents": [{ "uri": uri, "mimeType": "application/json", "text": node.to_string() }] })
    })
}

fn tool_call(object: &serde_json::Map<String, Value>, id: &Value) -> Option<Value> {
    let params = object.get("params")?;
    let tool = params.get("name")?.as_str()?;
    let arguments = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| json!({}));
    Some(json!({
        "content": [{ "type": "text", "text": json!({
            "requestId": id.to_string(), "tool": tool, "arguments": arguments
        }).to_string() }]
    }))
}

fn rpc_error(id: Value, code: i32, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

pub fn process_line(line: &str, context: &Value) -> String {
    let response = match serde_json::from_str::<Value>(line.trim_end_matches(['\r', '\n'])) {
        Ok(request) => handle_rpc(request, context.clone()),
        Err(error) => rpc_error(
            Value::Null,
            -32700,
            &format!("MCP 消息不是有效 JSON: {error}"),
        ),
    };
    format!("{response}\n")
}

#[cfg(test)]
mod tests {
    use super::{empty_context, handle_rpc, process_line};
    use serde_json::json;

    #[test]
    fn initializes_and_reports_parse_errors() {
        let response = handle_rpc(
            json!({ "jsonrpc": "2.0", "id": 1, "method": "initialize" }),
            empty_context(),
        );
        assert_eq!(response["result"]["protocolVersion"], "2024-11-05");
        let invalid: serde_json::Value =
            serde_json::from_str(&process_line("{bad", &empty_context())).expect("response JSON");
        assert_eq!(invalid["error"]["code"], -32700);
    }
}
