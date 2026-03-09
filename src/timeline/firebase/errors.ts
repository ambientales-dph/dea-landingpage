export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `Firestore Permission Denied: Cannot ${context.operation} on ${context.path}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
    // This is to make the error object serializable for the Next.js dev overlay
    Object.setPrototypeOf(this, FirestorePermissionError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      stack: this.stack,
      context: this.context,
    };
  }
}
