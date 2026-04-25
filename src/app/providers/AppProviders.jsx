import ThemeProvider from './ThemeProvider';
import { AuthProvider } from './AuthProvider';
import { WorkspaceProvider } from './WorkspaceProvider';

export default function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}