import { Request, Response, NextFunction } from "express";

/**
 * Authentication Middleware
 * 
 * Validates: Requirements 9.2, 9.3
 * - Requires authentication on all Body Map and Pain Session API endpoints
 * - Returns 401 Unauthorized with no data for unauthenticated requests
 */

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * Authentication middleware that validates user credentials
 * 
 * For now, this is a basic implementation that checks for an Authorization header.
 * In production, this should validate JWT tokens or session tokens.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  // Check if Authorization header is present
  if (!authHeader) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Basic validation: expect "Bearer <token>" format
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = parts[1];

  // Validate token (simplified for now - in production, verify JWT signature)
  if (!token || token.length === 0) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // In a real implementation, decode and verify the JWT token here
  // For now, we'll extract a userId from the token (simplified)
  // In production: const decoded = jwt.verify(token, SECRET_KEY);
  
  // Mock user ID extraction - in production, this comes from JWT payload
  req.userId = extractUserIdFromToken(token);

  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

/**
 * Extract user ID from token
 * 
 * This is a placeholder implementation. In production, this would:
 * 1. Verify JWT signature
 * 2. Check token expiration
 * 3. Extract userId from verified payload
 * 
 * @param token - Authentication token
 * @returns User ID if valid, undefined otherwise
 */
function extractUserIdFromToken(token: string): string | undefined {
  // Simplified implementation for testing
  // In production, use jsonwebtoken library to verify and decode
  try {
    // For testing purposes, accept tokens in format "user-<uuid>"
    if (token.startsWith("user-")) {
      return token;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Middleware to protect Body Map and Pain Session endpoints
 * This is an alias for requireAuth with clearer naming for these specific endpoints
 */
export const protectHealthDataEndpoint = requireAuth;
