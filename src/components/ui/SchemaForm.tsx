/**
 * SchemaForm.tsx
 * ==============
 * Thin wrapper around @rjsf/core for dynamic JSON Schema-based forms.
 * 
 * Consumes JSON Schema from backend (Pydantic model_json_schema()).
 * Used for plugin configuration in Settings Panel.
 * 
 * Reference: https://rjsf-team.github.io/react-jsonschema-form/docs/
 */

import Form, { type FormProps } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema } from '@rjsf/utils';

interface SchemaFormProps {
    /** JSON Schema from backend */
    schema: RJSFSchema;
    /** Current form data */
    formData: Record<string, unknown>;
    /** Called when form data changes */
    onChange: (data: Record<string, unknown>) => void;
    /** Called when form is submitted (optional) */
    onSubmit?: (data: Record<string, unknown>) => void;
    /** Disable form editing (optional) */
    disabled?: boolean;
    /** Show loading state (optional) */
    isLoading?: boolean;
}

/**
 * Dynamic form component that renders based on JSON Schema.
 * 
 * @example
 * ```tsx
 * <SchemaForm
 *   schema={whisperConfigSchema}
 *   formData={{ model_size: 'large-v3' }}
 *   onChange={(data) => setConfig(data)}
 * />
 * ```
 */
export function SchemaForm({
    schema,
    formData,
    onChange,
    onSubmit,
    disabled = false,
    isLoading = false,
}: SchemaFormProps) {
    // Handle form change
    const handleChange: FormProps['onChange'] = (e) => {
        if (e.formData) {
            onChange(e.formData as Record<string, unknown>);
        }
    };

    // Handle form submit
    const handleSubmit: FormProps['onSubmit'] = (e) => {
        if (onSubmit && e.formData) {
            onSubmit(e.formData as Record<string, unknown>);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="flex items-center gap-3 text-neutral-500">
                    <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    <span>Loading configuration...</span>
                </div>
            </div>
        );
    }

    // UI schema to hide verbose descriptions
    const uiSchema = {
        'ui:title': ' ',
        'ui:description': ' ',
        'ui:options': {
            label: true,
        },
    };

    return (
        <div className="schema-form">
            <Form
                schema={schema}
                uiSchema={uiSchema}
                formData={formData}
                validator={validator}
                onChange={handleChange}
                onSubmit={handleSubmit}
                disabled={disabled}
                liveValidate
            >
                {/* Hide default submit button if no onSubmit handler */}
                {!onSubmit && <></>}
            </Form>

            {/* Custom styling for RJSF forms */}
            <style>{`
                .schema-form .form-group {
                    margin-bottom: 1rem;
                }
                .schema-form label {
                    display: block;
                    font-weight: 500;
                    font-size: 0.875rem;
                    color: #374151;
                    margin-bottom: 0.25rem;
                }
                .schema-form input[type="text"],
                .schema-form input[type="number"],
                .schema-form select {
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid #d1d5db;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                    background: white;
                    transition: border-color 0.15s, box-shadow 0.15s;
                }
                .schema-form input:focus,
                .schema-form select:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
                }
                .schema-form input[type="checkbox"] {
                    width: 1rem;
                    height: 1rem;
                    margin-right: 0.5rem;
                }
                .schema-form .checkbox label {
                    display: inline-flex;
                    align-items: center;
                    font-weight: normal;
                }
                .schema-form .text-danger {
                    color: #dc2626;
                    font-size: 0.75rem;
                    margin-top: 0.25rem;
                }
                .schema-form .field-description,
                .schema-form > div > p,
                .schema-form > div > h5 {
                    display: none;
                }
                .schema-form .btn-info {
                    display: none;
                }
            `}</style>
        </div>
    );
}

export default SchemaForm;
