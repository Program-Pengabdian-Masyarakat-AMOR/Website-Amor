import { useEffect, useState, useCallback } from 'react';

// Hook toast. Pemakaian:
//   const { toast, toastProps } = useToast();
//   toast('Tersimpan.');  ... <Toast {...toastProps} />
export function useToast() {
  const [state, setState] = useState({ message: '', show: false });

  const toast = useCallback((message) => setState({ message, show: true }), []);
  const hide = useCallback(() => setState((s) => ({ ...s, show: false })), []);

  useEffect(() => {
    if (!state.show) return;
    const t = setTimeout(hide, 2400);
    return () => clearTimeout(t);
  }, [state.show, state.message, hide]);

  return { toast, toastProps: { ...state } };
}

export default useToast;
