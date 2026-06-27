import { useState, useCallback } from 'react';
import { runSpeedTest, type SpeedTestProgress } from '../lib/speedTest';
import { saveSpeedTest, generateId, getSettings } from '../lib/storage';
import type { SpeedTestResult } from '../types';
import type { CarrierId } from '../types';

export interface SpeedTestState {
  isRunning: boolean;
  progress: SpeedTestProgress | null;
  result: SpeedTestResult | null;
  error: string | null;
}

export function useSpeedTest(networkType: string) {
  const [state, setState] = useState<SpeedTestState>({
    isRunning: false,
    progress: null,
    result: null,
    error: null,
  });

  const start = useCallback(async () => {
    setState({ isRunning: true, progress: null, result: null, error: null });
    try {
      const { downloadMbps, uploadMbps, pingMs } = await runSpeedTest((progress) => {
        setState((prev) => ({ ...prev, progress }));
      });

      const settings = await getSettings();
      const result: SpeedTestResult = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        downloadMbps: parseFloat(downloadMbps.toFixed(2)),
        uploadMbps: parseFloat(uploadMbps.toFixed(2)),
        pingMs: Math.round(pingMs),
        carrierId: settings.selectedCarrierId as CarrierId,
        networkType,
      };

      await saveSpeedTest(result);
      setState({ isRunning: false, progress: null, result, error: null });
    } catch (err) {
      setState({
        isRunning: false,
        progress: null,
        result: null,
        error: err instanceof Error ? err.message : 'Speed test failed',
      });
    }
  }, [networkType]);

  const reset = useCallback(() => {
    setState({ isRunning: false, progress: null, result: null, error: null });
  }, []);

  return { ...state, start, reset };
}
