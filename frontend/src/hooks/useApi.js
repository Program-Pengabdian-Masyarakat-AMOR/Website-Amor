import { useCallback, useEffect, useState } from 'react';

// Hook fetch standar: menangani state loading / data / error + reload.
// Pemakaian: const { data, loading, error, reload } = useApi(() => api.get('/...'), []);
export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // fetcher di-memo lewat deps yang dioper pemanggil.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await run();
      setData(res);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await run();
        if (aktif) setData(res);
      } catch (err) {
        if (aktif) setError(err);
      } finally {
        if (aktif) setLoading(false);
      }
    })();
    return () => {
      aktif = false;
    };
  }, [run]);

  return { data, loading, error, reload: load };
}

export default useApi;
