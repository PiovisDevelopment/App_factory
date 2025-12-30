# UI Archetype Templates for Universal Application Generation
# Version: 3.0.0 (Strict: Tauri v1, Python 3.11, Venv)

# -----------------------------------------------------------------------------
# 1. Universal Dispatcher Hook
# -----------------------------------------------------------------------------
DISPATCHER_HOOK_TEMPLATE = """
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

export const useUniversalDispatch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dispatch = useCallback(async <T>(
    pluginId: string, 
    method: string, 
    payload: Record<string, any> = {}
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      console.log(`[Dispatch] ${pluginId}.${method}`, payload);
      const response = await invoke('dispatch', {
        pluginId,
        method,
        payload
      });
      return response as T;
    } catch (err: any) {
      console.error(`[Dispatch Error] ${pluginId}.${method}`, err);
      setError(err.toString());
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { dispatch, loading, error };
};
"""

# -----------------------------------------------------------------------------
# 2. Universal Event Hook
# -----------------------------------------------------------------------------
EVENT_HOOK_TEMPLATE = """
import { useEffect, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export const useUniversalEvent = <T>(
  eventName: string, 
  callback: (payload: T) => void
) => {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      unlisten = await listen<T>(eventName, (event) => {
        savedCallback.current(event.payload);
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [eventName]);
};
"""

# -----------------------------------------------------------------------------
# 3. Dashboard Archetype
# -----------------------------------------------------------------------------
DASHBOARD_TEMPLATE = """
import React, { useEffect, useState } from 'react';
import { Box, Grid, Paper, Typography, Button, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { DraggableWindow } from '@/components/common/DraggableWindow/DraggableWindow';
import { useUniversalDispatch } from '@/hooks/useUniversalDispatch';
import { useUniversalEvent } from '@/hooks/useUniversalEvent';
import { colors, spacing } from '@/styles/tokens';
import type { {MethodPascal}Request, {MethodPascal}Response } from '@/types/{domain}';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

export const {AppName}: React.FC = () => {
  const { dispatch, loading, error } = useUniversalDispatch();
  const [data, setData] = useState<{MethodPascal}Response | null>(null);
  const [progress, setProgress] = useState(0);

  const chartData = React.useMemo(() => {{
    const raw: any = data as any;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray((raw as any).items)) return (raw as any).items;
    if (raw && Array.isArray((raw as any).records)) return (raw as any).records;
    return [];
  }}, [data]);

  const [xKey, yKey] = React.useMemo(() => {{
    if (!Array.isArray(chartData) || chartData.length === 0) return ['', ''];
    const sample: any = chartData[0];
    const keys = Object.keys(sample);
    const xCandidate =
      keys.find((k) => /time|timestamp|date/i.test(k)) ||
      keys.find((k) => typeof (sample as any)[k] === 'string') ||
      '';
    const yCandidate =
      keys.find((k) => ['value', 'price', 'amount'].includes(k)) ||
      keys.find((k) => typeof (sample as any)[k] === 'number') ||
      '';
    return [xCandidate, yCandidate];
  }}, [chartData]);

  const hasChartData = chartData.length > 0 && xKey && yKey;

  useUniversalEvent('plugin-progress', (payload: any) => {
    if (payload.plugin_id === '{plugin_id}') {
      setProgress(payload.value);
    }
  });

  const fetchData = async () => {
    setProgress(0);
    const payload: {MethodPascal}Request = {{}};
    const result = await dispatch<{MethodPascal}Response>('{plugin_id}', '{method_name}', payload);
    if (result) {
      setData(result);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <DraggableWindow id="{app_id}" title="{AppName}" defaultWidth={800} defaultHeight={600}>
      <Box sx={{ p: spacing.md, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ mb: spacing.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" color={colors.text.primary}>{AppName}</Typography>
          <Button variant="contained" onClick={fetchData} disabled={loading}>Refresh</Button>
        </Box>
        {loading && <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />}
        {error && <Paper sx={{ p: 2, mb: 2, bgcolor: colors.semantic.error + '22', color: colors.semantic.error }}>{error}</Paper>}
        <Grid container spacing={2} sx={{ flex: 1 }}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, height: '100%', bgcolor: colors.background.tertiary, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" sx={{ mb: spacing.sm }}>Time Series</Typography>
              {hasChartData ? (
                <Box sx={{ flex: 1, mt: spacing.sm }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid stroke={colors.ui.divider} strokeDasharray="3 3" />
                      <XAxis dataKey={xKey} />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey={yKey} stroke={colors.accent.primary} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ mt: spacing.sm }}>
                  <Typography variant="body2" color={colors.text.secondary}>
                    No chartable data yet. Refresh or configure your plugin.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%', bgcolor: colors.background.tertiary, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" sx={{ mb: spacing.sm }}>Data Table</Typography>
              <Box sx={{ mt: spacing.sm, overflow: 'auto', maxHeight: '400px' }}>
                {Array.isArray(chartData) && chartData.length > 0 ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {Object.keys(chartData[0] as any).map((key) => (
                          <TableCell key={key}>{key}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {chartData.map((row, idx) => (
                        <TableRow key={idx}>
                          {Object.keys(chartData[0] as any).map((key) => (
                            <TableCell key={key}>
                              {String((row as any)[key])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography variant="body2" color={colors.text.secondary}>
                    No rows to display yet.
                  </Typography>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </DraggableWindow>
  );
};
"""

# -----------------------------------------------------------------------------
# 4. Canvas Archetype
# -----------------------------------------------------------------------------
CANVAS_TEMPLATE = """
import React, { useState } from 'react';
import { Box, IconButton, Tooltip, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import { DraggableWindow } from '@/components/common/DraggableWindow/DraggableWindow';
import { useUniversalDispatch } from '@/hooks/useUniversalDispatch';
import { colors } from '@/styles/tokens';

export const {AppName}: React.FC = () => {
  const { dispatch, loading } = useUniversalDispatch();
  
  return (
    <DraggableWindow id="{app_id}" title="{AppName}" defaultWidth={900} defaultHeight={700}>
      <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', bgcolor: '#111' }}>
        <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10, bgcolor: colors.background.secondary, borderRadius: '8px', p: 1, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
          <Tooltip title="Generate"><IconButton color="primary" disabled={loading}>{loading ? <CircularProgress size={24} /> : <RefreshIcon />}</IconButton></Tooltip>
          <Tooltip title="Save"><IconButton color="primary"><SaveIcon /></IconButton></Tooltip>
        </Box>
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          <span style={{ color: '#555' }}>Canvas Area</span>
        </Box>
      </Box>
    </DraggableWindow>
  );
};
"""

# -----------------------------------------------------------------------------
# 5. Form Archetype
# -----------------------------------------------------------------------------
FORM_TEMPLATE = """
import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Stack } from '@mui/material';
import { DraggableWindow } from '@/components/common/DraggableWindow/DraggableWindow';
import { useUniversalDispatch } from '@/hooks/useUniversalDispatch';
import { colors, spacing } from '@/styles/tokens';

export const {AppName}: React.FC = () => {
  const { dispatch, loading } = useUniversalDispatch();
  const [formData, setFormData] = useState({});

  const handleSubmit = async () => {
    // await dispatch('{plugin_id}', 'submit_data', formData);
  };

  return (
    <DraggableWindow id="{app_id}" title="{AppName}" defaultWidth={400} defaultHeight={500}>
      <Box sx={{ p: spacing.lg }}>
        <Typography variant="h5" sx={{ mb: spacing.lg }}>{AppName}</Typography>
        <Stack spacing={3}>
          <TextField label="Input 1" variant="outlined" fullWidth />
          <TextField label="Input 2" variant="outlined" fullWidth />
          <Button variant="contained" size="large" onClick={handleSubmit} disabled={loading}>{loading ? 'Processing...' : 'Submit'}</Button>
        </Stack>
      </Box>
    </DraggableWindow>
  );
};
"""

# -----------------------------------------------------------------------------
# 6. Package.json Template (Strict Tauri v1.8 Core)
# -----------------------------------------------------------------------------
PACKAGE_JSON_TEMPLATE = """{{
  "name": "{app_name}",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {{
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  }},
  "dependencies": {{
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "@mui/icons-material": "^5.14.0",
    "@mui/material": "^5.14.0",
    "@tauri-apps/api": "^1.6.0",
    "recharts": "^2.10.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-draggable": "^4.4.0",
    "react-resizable": "^3.0.0"
  }},
  "devDependencies": {{
    "@tauri-apps/cli": "^1.6.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.2",
    "vite": "^4.4.0"
  }}
}}
"""
