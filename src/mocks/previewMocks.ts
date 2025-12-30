/**
 * src/mocks/previewMocks.ts
 * =========================
 * Centralized mock data for FE UI Preview.
 * Used to hydrate components with dummy data when no live data is available.
 */

// DUMMY_DATA_START: Select options
export const mockSelectOptions = [
    { value: 'option-1', label: 'Option 1' },
    { value: 'option-2', label: 'Option 2' },
    { value: 'option-3', label: 'Option 3' },
];
// DUMMY_DATA_END

// DUMMY_DATA_START: Tab items
export const mockTabItems = [
    { id: 'tab-1', label: 'Tab 1', content: 'Content for Tab 1' },
    { id: 'tab-2', label: 'Tab 2', content: 'Content for Tab 2' },
    { id: 'tab-3', label: 'Tab 3', content: 'Content for Tab 3' },
];
// DUMMY_DATA_END

// DUMMY_DATA_START: Table data
export const mockTableData = [
    { id: 1, name: 'Item 1', status: 'Active' },
    { id: 2, name: 'Item 2', status: 'Inactive' },
    { id: 3, name: 'Item 3', status: 'Pending' },
];
// DUMMY_DATA_END

// MOCK_FUNCTION_START: Generic handler
export const mockEventHandler = (eventName: string, ...args: any[]) => {
    console.log(`[Preview Interaction] Event: ${eventName}`, args);
};
// MOCK_FUNCTION_END
