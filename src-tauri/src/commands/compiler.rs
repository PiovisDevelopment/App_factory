//! src-tauri/src/commands/compiler.rs
//! ===================================
//! Tauri command for TSX/TypeScript compilation using SWC.
//!
//! Provides in-process compilation of TSX/TypeScript to JavaScript
//! without requiring external tools or file I/O.
//!
//! Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
//!
//! Usage (TypeScript):
//!     ```typescript
//!     import { invoke } from '@tauri-apps/api/tauri';
//!
//!     const result = await invoke<CompileResult>('compile_tsx', {
//!         code: 'const Button = () => <button>Hello</button>;'
//!     });
//!     ```

use serde::Serialize;
use swc_common::{comments::NoopComments, sync::Lrc, FileName, Globals, Mark, SourceMap, GLOBALS};
use swc_ecma_ast::{EsVersion, Program};
use swc_ecma_codegen::{text_writer::JsWriter, Config as CodegenConfig, Emitter};
use swc_ecma_parser::{lexer::Lexer, Parser, StringInput, Syntax, TsSyntax};
use swc_ecma_transforms_base::{fixer::fixer, hygiene::hygiene, resolver};
use swc_ecma_transforms_react::{jsx, Options as JsxOptions, Runtime};
use swc_ecma_transforms_typescript::strip;

// ============================================
// TYPES
// ============================================

/// Result of TSX/TypeScript compilation.
/// Matches the frontend `CompileResult` interface.
#[derive(Debug, Clone, Serialize)]
pub struct CompileResult {
    /// Whether compilation succeeded
    pub success: bool,
    /// Compiled JavaScript code (None if error)
    pub code: Option<String>,
    /// Error message (None if success)
    pub error: Option<String>,
}

impl CompileResult {
    /// Create a successful result
    fn success(code: String) -> Self {
        Self {
            success: true,
            code: Some(code),
            error: None,
        }
    }

    /// Create an error result
    fn error(message: String) -> Self {
        Self {
            success: false,
            code: None,
            error: Some(message),
        }
    }
}

// ============================================
// COMPILATION LOGIC
// ============================================

/// Compile TSX/TypeScript code to JavaScript.
///
/// Pipeline:
/// 1. Parse TSX/TypeScript source
/// 2. Apply resolver (scope analysis)
/// 3. Strip TypeScript types
/// 4. Transform JSX to React.createElement calls
/// 5. Apply hygiene (fix identifier scoping)
/// 6. Apply fixer (ensure valid syntax)
/// 7. Generate JavaScript output
fn compile_tsx_internal(code: &str) -> Result<String, String> {
    // Create source map
    let cm: Lrc<SourceMap> = Lrc::default();

    // Create a virtual file for the source
    let fm = cm.new_source_file(FileName::Custom("input.tsx".into()).into(), code.to_string());

    // Configure parser for TSX
    let syntax = Syntax::Typescript(TsSyntax {
        tsx: true,
        decorators: false,
        dts: false,
        no_early_errors: true,
        ..Default::default()
    });

    // Parse the code
    let lexer = Lexer::new(syntax, EsVersion::Es2020, StringInput::from(&*fm), None);

    let mut parser = Parser::new_from(lexer);

    // Collect parse errors
    let errors: Vec<_> = parser.take_errors();
    if !errors.is_empty() {
        let error_msgs: Vec<String> = errors.iter().map(|e| format!("{e:?}")).collect();
        return Err(format!("Parse errors: {}", error_msgs.join("; ")));
    }

    let module = parser
        .parse_module()
        .map_err(|e| format!("Parse error: {e:?}"))?;

    // Wrap in Program for transforms
    let program = Program::Module(module);

    // Apply transforms within GLOBALS context
    let transformed_program = GLOBALS.set(&Globals::new(), || {
        let unresolved_mark = Mark::new();
        let top_level_mark = Mark::new();

        // Use the apply chain for passes
        program
            // 1. Resolver: scope analysis
            .apply(resolver(unresolved_mark, top_level_mark, true))
            // 2. Strip TypeScript types
            .apply(strip(unresolved_mark, top_level_mark))
            // 3. Transform JSX
            .apply(jsx::<NoopComments>(
                cm.clone(),
                None,
                JsxOptions {
                    runtime: Some(Runtime::Classic),
                    pragma: Some("React.createElement".into()),
                    pragma_frag: Some("React.Fragment".into()),
                    ..Default::default()
                },
                top_level_mark,
                unresolved_mark,
            ))
            // 4. Hygiene: fix identifier contexts
            .apply(hygiene())
            // 5. Fixer: ensure valid output
            .apply(fixer(None))
    });

    // Extract module from Program
    let module = match transformed_program {
        Program::Module(m) => m,
        Program::Script(_) => return Err("Expected module, got script".to_string()),
    };

    // Generate JavaScript code
    let mut buf = vec![];
    {
        let mut emitter = Emitter {
            cfg: CodegenConfig::default()
                .with_target(EsVersion::Es2020)
                .with_ascii_only(false)
                .with_minify(false)
                .with_omit_last_semi(false),
            cm: cm.clone(),
            comments: None,
            wr: JsWriter::new(cm, "\n", &mut buf, None),
        };

        emitter
            .emit_module(&module)
            .map_err(|e| format!("Emit error: {e:?}"))?;
    }

    String::from_utf8(buf).map_err(|e| format!("UTF-8 error: {e}"))
}

// ============================================
// TAURI COMMAND
// ============================================

/// Compile TSX/TypeScript code to JavaScript.
///
/// # Arguments
///
/// * `code` - TSX/TypeScript source code to compile
///
/// # Returns
///
/// `CompileResult` with success status and either compiled code or error message.
///
/// # Example (TypeScript)
///
/// ```typescript
/// const result = await invoke<CompileResult>('compile_tsx', {
///     code: 'const Button: React.FC = () => <button>Click me</button>;'
/// });
/// if (result.success) {
///     console.log('Compiled:', result.code);
/// } else {
///     console.error('Error:', result.error);
/// }
/// ```
#[tauri::command]
pub fn compile_tsx(code: &str) -> CompileResult {
    log::debug!("Command: compile_tsx (code length: {} chars)", code.len());

    match compile_tsx_internal(code) {
        Ok(js_code) => {
            log::debug!(
                "Compilation succeeded (output length: {} chars)",
                js_code.len()
            );
            CompileResult::success(js_code)
        }
        Err(error) => {
            log::warn!("Compilation failed: {error}");
            CompileResult::error(error)
        }
    }
}

// ============================================
// TESTS
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compile_simple_tsx() {
        let code = r#"const Button = () => <button>Hello</button>;"#;
        let result = compile_tsx(code);

        assert!(
            result.success,
            "Expected success, got error: {:?}",
            result.error
        );
        assert!(result.code.is_some());
        let js = result.code.unwrap();
        assert!(js.contains("React.createElement"));
        assert!(js.contains("button"));
    }

    #[test]
    fn test_compile_typescript_types() {
        let code = r#"
            interface Props { name: string; }
            const Greet = ({ name }: Props) => <div>Hello {name}</div>;
        "#;
        let result = compile_tsx(code);

        assert!(
            result.success,
            "Expected success, got error: {:?}",
            result.error
        );
        let js = result.code.unwrap();
        // TypeScript types should be stripped
        assert!(!js.contains("interface"));
        assert!(!js.contains(": string"));
    }

    #[test]
    fn test_compile_error_handling() {
        let code = r#"const x = <invalid syntax"#;
        let result = compile_tsx(code);

        assert!(!result.success);
        assert!(result.error.is_some());
        assert!(result.code.is_none());
    }

    #[test]
    fn test_compile_null_component() {
        let code = r#"const X = () => null;"#;
        let result = compile_tsx(code);

        assert!(
            result.success,
            "Expected success, got error: {:?}",
            result.error
        );
    }
}
