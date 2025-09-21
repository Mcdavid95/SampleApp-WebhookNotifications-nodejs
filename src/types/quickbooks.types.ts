export interface WebhookEventNotification {
  eventNotifications: EventNotification[];
}

export interface EventNotification {
  realmId: string;
  dataChangeEvent: DataChangeEvent;
}

export interface DataChangeEvent {
  entities: Entity[];
}

export interface Entity {
  name: string;
  id: string;
  operation: string;
  lastUpdated: string;
}

export interface NotificationRecord {
  realmId: string;
  name: string;
  id: string;
  operation: string;
  lastUpdated: string;
  fullData?: any;
  entityType?: string;
  fetchStatus?: 'success' | 'failed' | 'skipped';
  errorMessage?: string;
}

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  configurationEndpoint: string;
  authorization_endpoint: string;
  token_endpoint: string;
  api_uri: string;
  scopes: {
    sign_in_with_intuit: string[];
    connect_to_quickbooks: string[];
    connect_handler: string[];
  };
  webhookUri: string;
  webhooksVerifier: string;
}