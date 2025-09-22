import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { extractTokenFromRequest, verifyToken, generateToken } from '../services/authService.js';

describe('authService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('extractTokenFromRequest prefers Authorization header over cookie', () => {
    const req1 = { headers: { authorization: 'Bearer abc123' }, cookies: {} };
    expect(extractTokenFromRequest(req1)).toBe('abc123');

    const req2 = { headers: {}, cookies: { authToken: 'cookieToken' } };
    expect(extractTokenFromRequest(req2)).toBe('cookieToken');

    const req3 = { headers: {}, cookies: {} };
    expect(extractTokenFromRequest(req3)).toBeNull();
  });

  it('verifyToken returns null for invalid tokens', () => {
    const decoded = verifyToken('this.is.not.valid');
    expect(decoded).toBeNull();
  });

  it('generateToken creates a valid token that verifyToken decodes', () => {
    const user = { id: 42, username: 'admin', role: 'admin' };
    const token = generateToken(user);
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token);
    expect(decoded).toMatchObject({ id: 42, username: 'admin', role: 'admin' });
    // ensure issuer and audience are present
    expect(decoded.iss).toBeDefined();
    expect(decoded.aud).toBeDefined();
  });

  it('generateToken throws with missing required fields', () => {
    expect(() => generateToken({})).toThrow('Invalid user data for token generation');
    expect(() => generateToken({ id: 1, username: 'x' })).toThrow();
    expect(() => generateToken({ id: 1, role: 'admin' })).toThrow();
  });
});
