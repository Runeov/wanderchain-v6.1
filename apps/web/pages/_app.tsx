import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

const qc = new QueryClient();
export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={qc}>
      <Toaster />
      <Component {...pageProps} />
    </QueryClientProvider>
  );
}
