/**
 * B016 - src/components/ai/index.ts
 * ==================================
 * Barrel exports for AI components.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 */

// D069-D073: AI-Assisted Components
export { ChatInterface } from './ChatInterface';
export { ComponentGenerator } from './ComponentGenerator';
export { ConversationFlow } from './ConversationFlow';
export { ContractWizard } from './ContractWizard';
export { FixSuggestions } from './FixSuggestions';

// D093: Register New Contract Type Wizard (M6 remediation)
export { RegisterContractWizard } from './RegisterContractWizard';

// AI App Chat: Full-app AI assistant with Chat/Change modes
export { AiAppChatPanel, AiAppChatIcon } from './AiAppChatPanel';
export { AiChatSettingsModal } from './AiChatSettingsModal';
