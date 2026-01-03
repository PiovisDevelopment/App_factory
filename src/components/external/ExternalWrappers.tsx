import React from 'react';
import MuiButton from '@mui/material/Button';

// =============================================================================
// 1. MATERIAL UI ADAPTER
// =============================================================================
export const MuiButtonAdapter = (props: any) => {
    return (
        <MuiButton
            variant={props.variant || 'contained'}
            color={props.color || 'primary'}
            onClick={() => alert('MUI Button Clicked!')}
            sx={{ width: '100%', height: '100%' }}
        >
            {props.children || props.label || 'MUI Button'}
        </MuiButton>
    );
};

// =============================================================================
// 2. REACT COMPONENTS BLOCK ADAPTER (Simulating Block 1056)
// =============================================================================
export const DashboardStatsBlock = (props: any) => {
    return (
        <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 font-sans h-full flex flex-col justify-center overflow-hidden">
            <div className="flex justify-between items-start mb-2 w-full">
                <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-medium text-gray-500 truncate">{props.title || 'Total Revenue'}</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1 truncate" title={props.value || '$45,231.89'}>
                        {props.value || '$45,231.89'}
                    </h3>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium h-6 whitespace-nowrap ${(props.trend || '+20.1%').startsWith('+')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                    {props.trend || '+20.1%'}
                </span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mt-2 shrink-0">
                <div
                    className="h-full bg-blue-500"
                    style={{ width: props.progress ? `${props.progress}%` : '70%' }}
                />
            </div>
            <p className="text-xs text-gray-400 mt-2 truncate">{props.footer || 'Compared to last month'}</p>
        </div>
    );
};

// =============================================================================
// 3. GITHUB COMPONENT ADAPTER (Simulating @mui/monorepo)
// =============================================================================
export const GitHubRepoPreview = (props: any) => {
    return (
        <div className="flex items-center gap-3 p-3 bg-slate-800 text-white rounded border border-slate-700 h-full w-full">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold shrink-0">
                GH
            </div>
            <div className="overflow-hidden">
                <div className="font-semibold truncate">{props.name || '@mui/monorepo'}</div>
                <div className="text-xs opacity-75">{props.version || 'v7.3.6'}</div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                    {props.description || 'Material UI Monorepo'}
                </div>
            </div>
        </div>
    );
}
