import { createContext } from 'react';

/**
 * Lets the relation edge trigger actions owned by the editor (inverting both
 * sides). It lives in its own module so `RelationEdge.tsx` exports only its
 * component and stays fast-refresh friendly.
 */
export const RelationActionsContext = createContext<{ flip: (id: string) => void } | null>(null);
