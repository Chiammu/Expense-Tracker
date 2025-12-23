declare module '@google/genai' {
  export enum Type {
    /**
     * Not specified, should not be used.
     */
    TYPE_UNSPECIFIED = 'TYPE_UNSPECIFIED',
    /**
     * OpenAPI string type
     */
    STRING = 'STRING',
    /**
     * OpenAPI number type
     */
    NUMBER = 'NUMBER',
    /**
     * OpenAPI integer type
     */
    INTEGER = 'INTEGER',
    /**
     * OpenAPI boolean type
     */
    BOOLEAN = 'BOOLEAN',
    /**
     * OpenAPI array type
     */
    ARRAY = 'ARRAY',
    /**
     * OpenAPI object type
     */
    OBJECT = 'OBJECT',
    /**
     * Null type
     */
    NULL = 'NULL',
  }

  // Fix: Added missing FunctionDeclaration interface
  export interface FunctionDeclaration {
    name: string;
    parameters: {
      type: Type;
      properties?: Record<string, any>;
      required?: string[];
      description?: string;
    };
    description?: string;
  }

  export class GoogleGenAI {
    constructor(config: { apiKey: string });
    models: {
      generateContent(params: any): Promise<any>;
    };
    chats: {
      create(config: any): any;
    };
  }
}