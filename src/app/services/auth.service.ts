import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'; // ⬅️ ADD HttpHeaders here
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl.replace('/api', ''); // Remove /api suffix since auth service adds endpoints directly
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  // 1. Define the Ngrok Header and JSON Content Type centrally
  private ngrokHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true' 
  });

  constructor(private http: HttpClient) {
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get isAuthenticated(): boolean {
    return !!this.getToken();
  }

  public get userRole(): string | null {
    const user = this.currentUserValue;
    return user ? user.role : null;
  }

  public get isAdmin(): boolean {
    return this.userRole === 'admin';
  }

  register(username: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.apiUrl}/api/auth/register`, 
      { username, email, password },
      { headers: this.ngrokHeaders } // ⬅️ 2. Pass the Ngrok headers here
    ).pipe(
      map(response => {
        // Store user details and token in local storage
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        localStorage.setItem('token', response.token);
        this.currentUserSubject.next(response.user);
        return response;
      })
    );
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.apiUrl}/api/auth/login`, 
      { username, password },
      { headers: this.ngrokHeaders } // ⬅️ 3. Pass the Ngrok headers here
    ).pipe(
      map(response => {
        // Store user details and token in local storage
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        localStorage.setItem('token', response.token);
        this.currentUserSubject.next(response.user);
        return response;
      })
    );
  }

  logout(): Observable<any> {
    const token = this.getToken();
    
    // Always clear local storage regardless of server response
    const clearStorage = () => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('token');
      this.currentUserSubject.next(null);
    };
    
    if (!token) {
      // If no token, just clear storage and return success
      clearStorage();
      return of({ success: true });
    }

    // Reuse the Ngrok headers, but also include Authorization
    const logoutHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true', // ⬅️ Ngrok header
      'Authorization': `Bearer ${token}` 
    });
    
    return this.http.post(`${this.apiUrl}/api/auth/logout`, {}, {
      headers: logoutHeaders // ⬅️ Use combined headers for logout
    }).pipe(
      map(response => {
        clearStorage();
        return response;
      }),
      // If server request fails, still clear storage locally
      catchError((error: any) => {
        console.warn('Logout request failed, but clearing local storage:', error);
        clearStorage();
        return of({ success: true, message: 'Logged out locally' });
      })
    );
  }

  getProfile(): Observable<{ user: User }> {
    // Note: You may need to update this to include both the Ngrok header and Auth token
    const profileHeaders = new HttpHeaders({
      'ngrok-skip-browser-warning': 'true',
      ...this.getAuthHeaders() // Merge existing auth headers
    });
    
    return this.http.get<{ user: User }>(`${this.apiUrl}/api/auth/profile`, { 
        headers: profileHeaders 
    });
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getAuthHeaders(): { [key: string]: string } {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Check if token is expired (basic check)
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch {
      return true;
    }
  }

  // Auto logout if token is expired
  checkTokenExpiration(): void {
    if (this.isTokenExpired()) {
      this.logout().subscribe();
    }
  }
}