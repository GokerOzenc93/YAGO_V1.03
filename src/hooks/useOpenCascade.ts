import { useState, useEffect } from 'react';
import initOpenCascade from 'opencascade.js';
import type { OpenCascadeInstance } from 'opencascade.js';

export const useOpenCascade = () => {
  const [oc, setOc] = useState<OpenCascadeInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadOpenCascade = async () => {
      try {
        console.log('🔧 Loading OpenCascade.js...');
        const instance = await initOpenCascade();

        if (mounted) {
          setOc(instance);
          setIsLoading(false);
          console.log('✅ OpenCascade.js loaded successfully');
        }
      } catch (err) {
        console.error('❌ Failed to load OpenCascade.js:', err);
        if (mounted) {
          setError(err as Error);
          setIsLoading(false);
        }
      }
    };

    loadOpenCascade();

    return () => {
      mounted = false;
    };
  }, []);

  return { oc, isLoading, error };
};
