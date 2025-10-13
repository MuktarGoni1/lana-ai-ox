"use client";

import { useToast } from "@/hooks/use-toast";

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_SIZE_LIMIT = 50; // Maximum number of cached responses

// In-memory cache structure
type CacheEntry = {
  data: any;
  timestamp: number;
};

class ApiCache {
  private cache: Map<string, CacheEntry> = new Map();

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: any): void {
    // Enforce cache size limit
    if (this.cache.size >= CACHE_SIZE_LIMIT) {
      // Remove oldest entry if cache is full
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  invalidate(keyPattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (keyPattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Singleton cache instance
const apiCache = new ApiCache();

// Production-safe error logging helper
const isDev = process.env.NODE_ENV === 'development';
const logError = (...args: any[]) => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
};

// API client with caching
export const apiClient = {
  // GET request with caching
  async get<T>(url: string, options?: RequestInit, bypassCache = false): Promise<T> {
    const cacheKey = `GET:${url}`;
    
    // Try to get from cache unless bypass is requested
    if (!bypassCache) {
      const cachedData = apiCache.get(cacheKey);
      if (cachedData) {
        return cachedData as T;
      }
    }

    // Fetch fresh data
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        // Enhanced error handling with more specific error messages
        let errorMessage = `API error: ${response.status}`;
        
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If we can't parse the error response, use status text
          errorMessage = `${response.status} ${response.statusText}`;
        }
        
        // For specific status codes, provide user-friendly messages
        if (response.status === 500) {
          errorMessage = 'Server error - please try again later';
        } else if (response.status === 404) {
          errorMessage = 'Resource not found';
        } else if (response.status === 403) {
          errorMessage = 'Access denied';
        } else if (response.status >= 500) {
          errorMessage = 'Server error - please try again later';
        } else if (response.status >= 400) {
          errorMessage = 'Request failed - please check your input';
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Cache the response
      apiCache.set(cacheKey, data);
      
      return data as T;
    } catch (error) {
      logError('API request failed:', error);
      throw error;
    }
  },

  // POST request (no caching for mutations)
  async post<T>(url: string, body: any, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: JSON.stringify(body),
        ...options,
      });

      if (!response.ok) {
        // Enhanced error handling with more specific error messages
        let errorMessage = `API error: ${response.status}`;
        
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If we can't parse the error response, use status text
          errorMessage = `${response.status} ${response.statusText}`;
        }
        
        // For specific status codes, provide user-friendly messages
        if (response.status === 500) {
          errorMessage = 'Server error - please try again later';
        } else if (response.status === 404) {
          errorMessage = 'Resource not found';
        } else if (response.status === 403) {
          errorMessage = 'Access denied';
        } else if (response.status >= 500) {
          errorMessage = 'Server error - please try again later';
        } else if (response.status >= 400) {
          errorMessage = 'Request failed - please check your input';
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Invalidate related GET caches
      apiCache.invalidate(new RegExp(`GET:${url}`));
      
      return data as T;
    } catch (error) {
      logError('API request failed:', error);
      throw error;
    }
  },

  // Clear all cache
  clearCache(): void {
    apiCache.clear();
  }
};

// React hook for API requests with toast notifications
export function useApi() {
  const { toast } = useToast();

  return {
    async get<T>(url: string, options?: RequestInit, bypassCache = false): Promise<T> {
      try {
        return await apiClient.get<T>(url, options, bypassCache);
      } catch (error) {
        toast({
          title: "Request Failed",
          description: error instanceof Error ? error.message : "Unknown error occurred",
          variant: "destructive",
        });
        throw error;
      }
    },

    async post<T>(url: string, body: any, options?: RequestInit): Promise<T> {
      try {
        return await apiClient.post<T>(url, body, options);
      } catch (error) {
        toast({
          title: "Request Failed",
          description: error instanceof Error ? error.message : "Unknown error occurred",
          variant: "destructive",
        });
        throw error;
      }
    }
  };
}