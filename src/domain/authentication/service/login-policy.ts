/**
 * Login Policy for Authentication
 *
 * Tracks failed login attempts by IP address to prevent brute-force attacks
 * without locking out legitimate users by email.
 */
export interface LoginPolicy {
  /** Check if a login attempt is allowed for this IP */
  canAttemptLogin(ip: string): Promise<boolean>;

  /** Record a failed login attempt for this IP */
  recordFailedLogin(ip: string): Promise<void>;

  /** Reset failed login attempts for this IP (e.g. on successful login) */
  resetFailedLogins(ip: string): Promise<void>;
}
