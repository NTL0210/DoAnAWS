import '../styles/globals.css';
import Head from 'next/head';
import { useEffect } from 'react';
import { WorkspaceProvider, useWorkspace } from '@/context/WorkspaceContext';
import { VoiceConnectionProvider, useVoiceConnection } from '@/context/VoiceConnectionContext';

// Initialize Cognito Amplify Auth
import '@/lib/cognito';

export default function MyApp({ Component, pageProps }) {
  return (
    <WorkspaceProvider>
      <GlobalVoiceProvider>
        <Head>
          <title>AI Meeting Workforce Platform</title>
          <meta name="description" content="AI-powered internal meeting & workforce management" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <Component {...pageProps} />
      </GlobalVoiceProvider>
    </WorkspaceProvider>
  );
}

function GlobalVoiceProvider({ children }) {
  const { currentUser, activeWorkspace, workspaceRole } = useWorkspace();
  return (
    <VoiceConnectionProvider
      currentUser={currentUser}
      workspaceId={activeWorkspace?.id}
      workspaceRole={workspaceRole}
    >
      <VoicePresenceBridge />
      {children}
    </VoiceConnectionProvider>
  );
}

function VoicePresenceBridge() {
  const { presenceByChannel } = useVoiceConnection();
  const { setVoiceChannelParticipants } = useWorkspace();

  useEffect(() => {
    Object.entries(presenceByChannel || {}).forEach(([channelId, participants]) => {
      setVoiceChannelParticipants(channelId, participants);
    });
  }, [presenceByChannel, setVoiceChannelParticipants]);

  return null;
}
