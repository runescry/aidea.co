'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BUILDER_NAV_EVENT,
  isBuilderNavEnabled,
  setBuilderNavEnabled,
} from '@/lib/client/builder-nav';

export function useBuilderNav() {
  const [builderNav, setBuilderNavState] = useState(false);

  useEffect(() => {
    setBuilderNavState(isBuilderNavEnabled());
    const sync = () => setBuilderNavState(isBuilderNavEnabled());
    window.addEventListener(BUILDER_NAV_EVENT, sync);
    return () => window.removeEventListener(BUILDER_NAV_EVENT, sync);
  }, []);

  const setBuilderNav = useCallback((enabled: boolean) => {
    setBuilderNavEnabled(enabled);
    setBuilderNavState(enabled);
  }, []);

  return { builderNav, setBuilderNav };
}
