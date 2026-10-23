import { Toaster } from 'react-hot-toast';

/** Shared toast host — respects iOS safe area (status bar / Dynamic Island). */
export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      containerStyle={{
        top: 'max(12px, env(safe-area-inset-top))',
        right: 'max(12px, env(safe-area-inset-right))',
        left: 'max(12px, env(safe-area-inset-left))',
      }}
      toastOptions={{
        style: {
          maxWidth: 'min(100vw - 24px, 24rem)',
        },
      }}
    />
  );
}
