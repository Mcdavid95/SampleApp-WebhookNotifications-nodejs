export interface CustomFieldDefinition {
  id: string;
  name: string;
  dataType: 'STRING' | 'NUMERIC' | 'BOOLEAN' | 'DATE';
  entityTypes: string[];
  isRequired: boolean;
  isActive: boolean;
  allowedValues?: string[];
}

export interface CustomFieldDefinitionsResponse {
  data: {
    company: {
      appFoundationsCustomFieldDefinitions: {
        edges: {
          node: CustomFieldDefinition;
        }[];
        pageInfo: {
          hasNextPage: boolean;
          endCursor?: string;
        };
      };
    };
  };
}

export interface GraphQLResponse<T> {
  data: T;
  errors?: {
    message: string;
    extensions?: any;
  }[];
}