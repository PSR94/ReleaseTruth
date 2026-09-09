use serde_json::{Map, Value};

/// Canonicalize JSON objects recursively while preserving array order.
///
/// Array order is observable behavior by default. Callers that know an array is semantically
/// unordered must normalize that array explicitly before canonicalization.
pub fn canonicalize(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            let mut result = Map::with_capacity(map.len());
            for key in keys {
                result.insert(key.clone(), canonicalize(&map[key]));
            }
            Value::Object(result)
        }
        Value::Array(items) => Value::Array(items.iter().map(canonicalize).collect()),
        primitive => primitive.clone(),
    }
}

pub fn canonical_json(value: &Value) -> Result<String, serde_json::Error> {
    serde_json::to_string(&canonicalize(value))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn sorts_objects_but_preserves_arrays() {
        let value = json!({"z": 1, "a": {"d": 4, "b": 2}, "items": [2, 1]});
        assert_eq!(
            canonical_json(&value).unwrap(),
            r#"{"a":{"b":2,"d":4},"items":[2,1],"z":1}"#
        );
    }
}
