type EnvMap = Record<string, string | undefined>;

function getEnvValue(key: string): string | undefined {
  const importMetaEnv = (import.meta as ImportMeta & { env?: EnvMap }).env;
  const processEnv = (globalThis as { process?: { env?: EnvMap } }).process?.env;
  const runtimeEnv = (globalThis as { __env?: EnvMap }).__env;

  return importMetaEnv?.[key] ?? processEnv?.[key] ?? runtimeEnv?.[key];
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

const defaultApiUrl = 'https://workflow-core.duckdns.org/api';
const defaultApiIaUrl = 'https://workflow-ia.duckdns.org';
const apiUrl = normalizeBaseUrl(getEnvValue('API_URL') ?? defaultApiUrl);
const apiIaUrl = normalizeBaseUrl(getEnvValue('API_IA_URL') ?? defaultApiIaUrl);
const backendBaseUrl = apiUrl.replace(/\/api\/?$/, '');
const wsProtocolBaseUrl = backendBaseUrl.replace(/^http/, 'ws');
const sockJsBaseUrl = backendBaseUrl;

export const environment = {
  apiUrl,
  apiIaUrl,
  authUrl: `${apiUrl}/auth`,
  workflowsUrl: `${apiUrl}/workflows`,
  processInstancesUrl: `${apiUrl}/process-instances`,
  notificationsUrl: `${apiUrl}/notifications`,
  websocketUrl: `${wsProtocolBaseUrl}/ws/workflow`,
  websocketSockJsUrl: `${sockJsBaseUrl}/ws/workflow`
};
