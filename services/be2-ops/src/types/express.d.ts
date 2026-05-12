declare global {
  namespace Express {
    interface Request {
      bluesafeAuth?: {
        role: import("../auth.js").BluesafeRole;
        tenantId?: string;
        landlordId?: string;
      };
    }
  }
}

export {};
