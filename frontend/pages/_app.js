import '../styles/globals.css';
import Head from 'next/head';
import { WorkspaceProvider } from '@/context/WorkspaceContext';

// Initialize Cognito Amplify Auth
import '@/lib/cognito';

export default function MyApp({ Component, pageProps }) {
  return (
    <WorkspaceProvider>
      <Head>
        <title>AI Meeting Workforce Platform</title>
        <meta name="description" content="AI-powered internal meeting & workforce management" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </WorkspaceProvider>
  );
}
