// Thin compatibility shim — the real implementation now lives in the shared
// FloatingDock (see ./floating/FloatingDock.tsx). All floating buttons register
// with the dock so they can be dragged in/out and share one scrollable strip.
export {
  FloatingActionButtonCompat as FloatingActionButton,
  type FloatingActionButtonCompatProps as FloatingActionButtonProps,
} from './floating/FloatingDock';
