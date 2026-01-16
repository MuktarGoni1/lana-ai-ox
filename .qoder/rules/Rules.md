---
trigger: manual
---
# AI Coding Rules - Next.js Frontend + FastAPI Backend + Supabase

> **AI Role**: Act as an experienced senior software engineer. Provide production-ready code that scales to 10,000+ users. Always explain WHY, not just WHAT.

---

# 🎨 FRONTEND RULES (Next.js + Supabase)

## 📋 Core Frontend Principles

1. **Server Components First** - Use Client Components only for interactivity
2. **Supabase Auth Helpers** - Use official auth helpers, never roll your own
3. **Type Safety** - Generate and use Supabase TypeScript types
4. **Data Service Layer** - Never call Supabase directly in components
5. **Error Boundaries** - Graceful error handling everywhere
6. **Anon Key Only** - NEVER use service role key on frontend

---

## 🏗️ Frontend Architecture Rules

### 1. Project Structure (MANDATORY)

```
app/
├── (auth)/              # Auth-related routes
│   ├── login/
│   └── signup/
├── (dashboard)/         # Protected routes
│   └── dashboard/
├── api/                 # API routes (minimal, prefer Server Components)
├── components/
│   ├── ui/             # Reusable UI (buttons, inputs)
│   └── features/       # Feature-specific components
lib/
├── supabase/
│   ├── client.ts       # Client Component Supabase
│   ├── server.ts       # Server Component Supabase
│   └── middleware.ts   # Auth middleware
├── services/           # Data access layer
│   ├── userService.ts
│   ├── orderService.ts
│   └── productService.ts
├── hooks/              # Custom React hooks
│   ├── useAuth.ts
│   └── useOrders.ts
└── utils/              # Helper functions
types/
└── supabase.ts         # Generated types
middleware.ts           # Next.js middleware for auth
```

### 2. Supabase Client Setup (MANDATORY)

```typescript
// lib/supabase/client.ts - Client Components
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

export const createClient = () => createClientComponentClient<Database>();

// lib/supabase/server.ts - Server Components
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export const createServerClient = () => {
  return createServerComponentClient<Database>({ cookies });
};

// lib/supabase/middleware.ts - Route Protection
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protect dashboard routes
  if (req.nextUrl.pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Protect admin routes
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    const role = user?.user_metadata?.role;
    
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
```

### 3. Service Layer Pattern (MANDATORY)

**❌ FORBIDDEN: Direct Supabase calls in components**

```typescript
// DON'T DO THIS
'use client'
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  const supabase = createClient();
  
  useEffect(() => {
    supabase.from('users').select('*').eq('id', userId).single()
      .then(({ data }) => setUser(data));
  }, [userId]);
  
  return <div>{user?.name}</div>;
}
```

**✅ REQUIRED: Use service layer**

```typescript
// lib/services/userService.ts
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';

type User = Database['public']['Tables']['users']['Row'];

export class UserService {
  private supabase = createClient();

  async getUser(userId: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, email, name, role, created_at')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to fetch user:', error);
      throw new Error('Unable to load user data');
    }
  }

  async getUserWithOrders(userId: string) {
    try {
      // ✅ Use foreign key expansion - single query!
      const { data, error } = await this.supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          orders (
            id,
            status,
            total_amount,
            created_at,
            order_items (
              quantity,
              unit_price,
              product:products (
                id,
                name
              )
            )
          )
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to fetch user with orders:', error);
      throw new Error('Unable to load user data');
    }
  }

  async updateUser(userId: string, updates: Partial<User>) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to update user:', error);
      throw new Error('Unable to update user');
    }
  }

  async searchUsers(searchTerm: string, limit = 20) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, email, name')
        .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to search users:', error);
      return [];
    }
  }
}

// Usage in Client Component with React Query
'use client'
import { useQuery } from '@tanstack/react-query';
import { UserService } from '@/lib/services/userService';

function UserProfile({ userId }: { userId: string }) {
  const userService = new UserService();
  
  const { data: user, error, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userService.getUser(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  if (isLoading) return <Spinner />;
  if (error) return <ErrorDisplay error={error} />;
  if (!user) return <div>User not found</div>;
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// ✅ PREFERRED: Server Component (no API call from browser!)
import { createServerClient } from '@/lib/supabase/server';

async function UserProfileServer({ userId }: { userId: string }) {
  const supabase = createServerClient();
  
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return <div>User not found</div>;
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

### 4. Authentication Patterns (MANDATORY)

```typescript
// hooks/useAuth.ts - Custom auth hook
'use client'
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, signOut };
}

// app/login/page.tsx - Login page
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      router.push('/dashboard');
      router.refresh(); // Refresh server components
    } catch (error: any) {
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="max-w-md mx-auto p-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="w-full px-4 py-2 border rounded mb-4"
      />
      
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
        className="w-full px-4 py-2 border rounded mb-4"
      />
      
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-500 text-white py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}

// Server Component with auth check
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = createServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1>Welcome, {session.user.email}</h1>
      <OrdersList orders={orders || []} />
    </div>
  );
}
```

### 5. Data Types (MANDATORY)

```typescript
// types/supabase.ts - Generate with: supabase gen types typescript
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: 'admin' | 'user' | 'moderator';
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role?: 'admin' | 'user' | 'moderator';
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: 'admin' | 'user' | 'moderator';
          created_at?: string;
        };
      };
      // ... other tables
    };
  };
};

// ❌ FORBIDDEN: Using 'any'
function displayUser(user: any) {
  return user.name;
}

// ✅ REQUIRED: Proper types
import type { Database } from '@/types/supabase';

type User = Database['public']['Tables']['users']['Row'];

function displayUser(user: User) {
  return user.name;
}

// Zod for runtime validation
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user', 'moderator']),
  created_at: z.coerce.date(),
});

export function validateUser(data: unknown): User {
  return UserSchema.parse(data);
}
```

### 6. Error Handling (MANDATORY)

```typescript
// ❌ FORBIDDEN: No error handling
async function fetchUser(id: string) {
  const supabase = createClient();
  const { data } = await supabase.from('users').select('*').eq('id', id).single();
  return data;
}

// ✅ REQUIRED: Comprehensive error handling
async function fetchUser(id: string): Promise<User> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error('Failed to fetch user');
    }

    if (!data) {
      throw new Error('User not found');
    }

    return data;
  } catch (error) {
    console.error('Error in fetchUser:', error);
    throw error;
  }
}

// Error Boundary Component
'use client'
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 text-center">
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// app/error.tsx - Next.js error page
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <p className="text-gray-600 mb-4">{error.message}</p>
      <button
        onClick={() => reset()}
        className="bg-blue-500 text-white px-6 py-2 rounded"
      >
        Try again
      </button>
    </div>
  );
}
```

### 7. Input Validation & Sanitization (MANDATORY)

```typescript
// lib/utils/validation.ts
import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

export function sanitizeHTML(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: []
  });
}

export function sanitizeText(input: string): string {
  return input.trim().replace(/<[^>]*>/g, '');
}

// Form validation schemas
export const ProductSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name too long')
    .transform(sanitizeText),
  description: z.string()
    .max(5000, 'Description too long')
    .transform(sanitizeHTML),
  price: z.number()
    .positive('Price must be positive')
    .max(1000000, 'Price too high'),
  category: z.enum(['electronics', 'clothing', 'books', 'other']),
});

// Usage in form
'use client'
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function ProductForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(ProductSchema),
  });

  const onSubmit = async (data: z.infer<typeof ProductSchema>) => {
    try {
      // Data is validated and sanitized
      await createProduct(data);
    } catch (error) {
      console.error('Failed to create product:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('name')}
        placeholder="Product name"
        className="w-full px-4 py-2 border rounded"
      />
      {errors.name && (
        <p className="text-red-500 text-sm">{errors.name.message}</p>
      )}

      <textarea
        {...register('description')}
        placeholder="Description"
        className="w-full px-4 py-2 border rounded"
      />
      {errors.description && (
        <p className="text-red-500 text-sm">{errors.description.message}</p>
      )}

      <input
        {...register('price', { valueAsNumber: true })}
        type="number"
        step="0.01"
        placeholder="Price"
        className="w-full px-4 py-2 border rounded"
      />
      {errors.price && (
        <p className="text-red-500 text-sm">{errors.price.message}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {isSubmitting ? 'Creating...' : 'Create Product'}
      </button>
    </form>
  );
}
```

### 8. Performance Optimization (MANDATORY)

```typescript
// ❌ FORBIDDEN: Fetching all data without pagination
async function getProducts() {
  const supabase = createClient();
  const { data } = await supabase.from('products').select('*');
  return data;
}

// ✅ REQUIRED: Pagination, specific columns, filtering
async function getProducts(page = 1, pageSize = 20) {
  const supabase = createClient();
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from('products')
    .select('id, name, price, category', { count: 'exact' })
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw error;

  return {
    products: data || [],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

// Use Next.js caching
async function ProductListServer() {
  const supabase = createServerClient();
  
  // Cached for 1 hour
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true);

  return <ProductList products={products || []} />;
}

// Revalidate cache on-demand
'use server'
import { revalidateTag } from 'next/cache';

export async function updateProduct(id: string, updates: any) {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id);

  if (error) throw error;

  revalidateTag('products'); // Invalidate cache
}

// Image optimization
import Image from 'next/image';

function ProductCard({ product }: { product: Product }) {
  return (
    <div>
      <Image
        src={product.image_url}
        alt={product.name}
        width={300}
        height={300}
        priority={false}
        loading="lazy"
      />
      <h3>{product.name}</h3>
    </div>
  );
}

// Lazy load heavy components
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <p>Loading chart...</p>,
  ssr: false, // Don't render on server
});
```

### 9. Supabase Realtime (Use Sparingly)

```typescript
// ✅ ONLY use realtime for features that truly need it:
// - Chat applications
// - Live notifications
// - Collaborative editing
// - Real-time dashboards

// hooks/useRealtimeOrders.ts
'use client'
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';

type Order = Database['public']['Tables']['orders']['Row'];

export function useRealtimeOrders(userId: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // Initial fetch
    supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setOrders(data || []));

    // Subscribe to changes
    const channel = supabase
      .channel('order-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setOrders((prev) => [payload.new as Order, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((o) => (o.id === payload.new.id ? (payload.new as Order) : o))
            );
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return orders;
}

// Usage
'use client'
function OrdersLiveView({ userId }: { userId: string }) {
  const orders = useRealtimeOrders(userId);

  return (
    <div>
      <h2>Live Orders</h2>
      {orders.map((order) => (
        <div key={order.id}>
          Order #{order.id} - {order.status}
        </div>
      ))}
    </div>
  );
}
```

### 10. File Uploads with Supabase Storage

```typescript
// lib/services/storageService.ts
import { createClient } from '@/lib/supabase/client';

export class StorageService {
  private supabase = createClient();

  async uploadAvatar(
    userId: string,
    file: File
  ): Promise<string> {
    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${userId}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await this.supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = this.supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update user profile
      const { error: updateError } = await this.supabase
        .from('users')
        .update({ avatar_url: data.publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      return data.publicUrl;
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      throw error;
    }
  }

  async deleteAvatar(userId: string) {
    try {
      const { error } = await this.supabase.storage
        .from('avatars')
        .remove([`avatars/${userId}`]);

      if (error) throw error;

      // Clear avatar URL from profile
      await this.supabase
        .from('users')
        .update({ avatar_url: null })
        .eq('id', userId);
    } catch (error) {
      console.error('Failed to delete avatar:', error);
      throw error;
    }
  }
}

// Component usage
'use client'
import { useState } from 'react';
import { StorageService } from '@/lib/services/storageService';

export function AvatarUpload({ userId }: { userId: string }) {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const storageService = new StorageService();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    try {
      const file = e.target.files[0];
      const url = await storageService.uploadAvatar(userId, file);
      setAvatarUrl(url);
      alert('Avatar uploaded successfully!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {avatarUrl && (
        <Image
          src={avatarUrl}
          alt="Avatar"
          width={100}
          height={100}
          className="rounded-full"
        />
      )}
      
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
        className="block mt-2"
      />
      
      {uploading && <p>Uploading...</p>}
    </div>
  );
}
```

---

# 🔧 BACKEND RULES (FastAPI + Supabase)

## 📋 Core Backend Principles

1. **Repository Pattern** - All database access through repositories
2. **Service Layer** - Business logic separate from routes
3. **Dependency Injection** - Use FastAPI dependencies for everything
4. **Service Role Key Only** - Never use anon key on backend
5. **RLS + Backend Validation** - Defense in depth
6. **Async Everything** - All I/O operations must be async

---

## 🏗️ Backend Architecture Rules

### 1. Project Structure (MANDATORY)

```
app/
├── main.py              # FastAPI app, middleware, CORS
├── config.py            # Environment variables, settings
├── dependencies.py      # Reusable dependencies (auth, db)
├── models/              # Pydantic models for validation
│   ├── user.py
│   ├── order.py
│   └── product.py
├── routers/             # API endpoints by feature
│   ├── auth.py
│   ├── users.py
│   ├── orders.py
│   └── products.py
├── repositories/        # Data access layer
│   ├── base.py
│   ├── user_repository.py
│   ├── order_repository.py
│   └── product_repository.py
├── services/            # Business logic
│   ├── user_service.py
│   ├── order_service.py
│   └── email_service.py
└── utils/               # Helper functions
tests/
├── test_users.py
├── test_orders.py
└── conftest.py
```

### 2. Configuration (MANDATORY)

```python
# config.py - Configuration with validation
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Application settings with validation."""
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str  # NEVER use anon key on backend!
    SUPABASE_JWT_SECRET: str
    
    # Database (use connection pooler)
    DATABASE_URL: str  # Should use port 6543 (pooler) not 5432
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # External Services
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    
    # Monitoring
    SENTRY_DSN: Optional[str] = None
    LOG_LEVEL: str = "INFO"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

### 3. Supabase Client & Dependencies (MANDATORY)

```python
# dependencies.py - Supabase auth verification
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from config import settings
import logging

logger = logging.getLogger(__name__)
security = HTTPBearer()

def get_supabase_client() -> Client:
    """
    Get Supabase client for backend operations.
    IMPORTANT: Uses service role key, not anon key!
    """
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_KEY
    )

async def verify_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
    supabase: Client = Depends(get_supabase_client)
) -> dict:
    """
    Verify Supabase JWT token and extract user info.
    This dependency should be used on ALL protected routes.
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        token = credentials.credentials
        
        # Verify token with Supabase
        user_response = supabase.auth.get_user(token)
        
        if not user_response.user:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )
        
        # Extract user data
        user_data = {
            "id": user_response.user.id,
            "email": user_response.user.email,
            "role": user_response.user.user_metadata.get("role", "user")
        }
        
        logger.info(f"User authenticated: {user_data['id']}")
        return user_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials"
        )

async def get_current_user(
    user_data: dict = Depends(verify_token)
) -> dict:
    """
    Get current authenticated user.
    Use this dependency in your routes.
    """
    return user_data

async def require_admin(
    current_user: dict = Depends(get_current_user)
):
    """
    Ensure user has admin role.
    Use this dependency for admin-only routes.
    """
    if current_user.get("role") != "admin":
        logger.warning(f"Non-admin user {current_user['id']} attempted admin access")
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return current_user

async def require_role(required_role: str):
    """
    Factory function for role-based access control.
    
    Usage:
        @router.get("/moderator-only", dependencies=[Depends(require_role("moderator"))])
    """
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") != required_role:
            raise HTTPException(
                status_code=403,
                detail=f"{required_role.capitalize()} access required"
            )
        return current_user
    return role_checker
```

### 4. Repository Pattern (MANDATORY)

```python
# repositories/base.py - Base repository
from supabase import Client
from typing import TypeVar, Generic, List, Optional, Dict, Any
import logging

T = TypeVar('T')
logger = logging.getLogger(__name__)

class BaseRepository(Generic[T]):
    """Base repository with common CRUD operations."""
    
    def __init__(self, client: Client, table_name: str):
        self.client = client
        self.table_name = table_name
    
    async def get_by_id(self, id: str) -> Optional[Dict[str, Any]]:
        """Get single record by ID."""
        try:
            result = self.client.table(self.table_name)\
                .select("*")\
                .eq("id", id)\
                .maybe_single()\
                .execute()
            
            return result.data
        except Exception as e:
            logger.error(f"Failed to fetch {self.table_name} {id}: {e}")
            raise
    
    async def get_all(
        self, 
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get all records with pagination."""
        try:
            result = self.client.table(self.table_name)\
                .select("*")\
                .range(offset, offset + limit - 1)\
                .execute()
            
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch {self.table_name}: {e}")
            raise
    
    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new record."""
        try:
            result = self.client.table(self.table_name)\
                .insert(data)\
                .execute()
            
            if not result.data:
                raise Exception("Failed to create record")
            
            return result.data[0]
        except Exception as e:
            logger.error(f"Failed to create {self.table_name}: {e}")
            raise
    
    async def update(
        self, 
        id: str, 
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update existing record."""
        try:
            result = self.client.table(self.table_name)\
                .update(data)\
                .eq("id", id)\
                .execute()
            
            if not result.data:
                raise Exception("Record not found or update failed")
            
            return result.data[0]
        except Exception as e:
            logger.error(f"Failed to update {self.table_name} {id}: {e}")
            raise
    
    async def delete(self, id: str) -> bool:
        """Delete record."""
        try:
            result = self.client.table(self.table_name)\
                .delete()\
                .eq("id", id)\
                .execute()
            
            return True
        except Exception as e:
            logger.error(f"Failed to delete {self.table_name} {id}: {e}")
            raise

# repositories/user_repository.py - Specific repository
from typing import Optional, List, Dict, Any
from supabase import Client
from repositories.base import BaseRepository

class UserRepository(BaseRepository):
    """Repository for user data access."""
    
    def __init__(self, client: Client):
        super().__init__(client, "users")
    
    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email."""
        try:
            result = self.client.table(self.table_name)\
                .select("id, email, name, role, created_at")\
                .eq("email", email)\
                .maybe_single()\
                .execute()
            
            return result.data
        except Exception as e:
            logger.error(f"Failed to fetch user by email: {e}")
            raise
    
    async def get_with_orders(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user with their orders using foreign key expansion.
        ✅ This is a SINGLE query, not N+1!
        """
        try:
            result = self.client.table(self.table_name)\
                .select("""
                    id,
                    email,
                    name,
                    role,
                    created_at,
                    orders (
                        id,
                        status,
                        total_amount,
                        created_at,
                        order_items (
                            id,
                            quantity,
                            unit_price,
                            product:products (
                                id,
                                name,
                                price
                            )
                        )
                    )
                """)\
                .eq("id", user_id)\
                .maybe_single()\
                .execute()
            
            return result.data
        except Exception as e:
            logger.error(f"Failed to fetch user with orders: {e}")
            raise
    
    async def search(
        self, 
        search_term: str, 
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Search users by name or email."""
        try:
            result = self.client.table(self.table_name)\
                .select("id, email, name, role")\
                .or_(f"name.ilike.%{search_term}%,email.ilike.%{search_term}%")\
                .limit(limit)\
                .execute()
            
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to search users: {e}")
            raise

# repositories/order_repository.py
from typing import List, Dict, Any
from supabase import Client
from repositories.base import BaseRepository

class OrderRepository(BaseRepository):
    """Repository for order data access."""
    
    def __init__(self, client: Client):
        super().__init__(client, "orders")
    
    async def get_user_orders(
        self,
        user_id: str,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> tuple[List[Dict[str, Any]], int]:
        """
        Get orders for a specific user with optional filtering.
        Returns (orders, total_count)
        """
        try:
            query = self.client.table(self.table_name)\
                .select("*", count="exact")\
                .eq("user_id", user_id)
            
            if status:
                query = query.eq("status", status)
            
            result = query\
                .order("created_at", desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()
            
            return result.data or [], result.count or 0
        except Exception as e:
            logger.error(f"Failed to fetch user orders: {e}")
            raise
    
    async def create_with_items(
        self,
        order_data: Dict[str, Any],
        items_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create order with items using Supabase RPC for transaction.
        ✅ Uses database function for atomic operation.
        """
        try:
            result = self.client.rpc(
                "create_order_with_items",
                {
                    "order_data": order_data,
                    "items_data": items_data
                }
            ).execute()
            
            if not result.data:
                raise Exception("Failed to create order")
            
            return result.data[0] if isinstance(result.data, list) else result.data
        except Exception as e:
            logger.error(f"Failed to create order with items: {e}")
            raise
    
    async def get_user_summary(self, user_id: str) -> Dict[str, Any]:
        """
        Get order summary using Supabase RPC for aggregations.
        ✅ Uses database function instead of fetching all data.
        """
        try:
            result = self.client.rpc(
                "get_user_orders_summary",
                {"uid": user_id}
            ).execute()
            
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to fetch order summary: {e}")
            raise

def get_user_repository(
    supabase: Client = Depends(get_supabase_client)
) -> UserRepository:
    """Dependency for UserRepository."""
    return UserRepository(supabase)

def get_order_repository(
    supabase: Client = Depends(get_supabase_client)
) -> OrderRepository:
    """Dependency for OrderRepository."""
    return OrderRepository(supabase)
```

### 5. Pydantic Models (MANDATORY)

```python
# models/user.py - Data validation models
from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional
from datetime import datetime
import bleach

class UserBase(BaseModel):
    """Base user model with common fields."""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)
    
    @validator('name')
    def sanitize_name(cls, v):
        """Remove HTML tags from name."""
        v = bleach.clean(v, tags=[], strip=True)
        if not v.strip():
            raise ValueError('Name cannot be empty after sanitization')
        return v.strip()

class UserCreate(UserBase):
    """Model for creating new user."""
    password: str = Field(..., min_length=8, max_length=100)
    role: Optional[str] = Field("user", regex="^(admin|user|moderator)$")

class UserUpdate(BaseModel):
    """Model for updating user."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    role: Optional[str] = Field(None, regex="^(admin|user|moderator)$")
    
    @validator('name')
    def sanitize_name(cls, v):
        if v:
            v = bleach.clean(v, tags=[], strip=True)
            if not v.strip():
                raise ValueError('Name cannot be empty after sanitization')
            return v.strip()
        return v

class UserResponse(UserBase):
    """Model for user response."""
    id: str
    role: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# models/order.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

class OrderItemCreate(BaseModel):
    """Model for creating order item."""
    product_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0, le=1000)
    unit_price: Decimal = Field(..., gt=0, max_digits=10, decimal_places=2)
    
    @validator('unit_price')
    def validate_price(cls, v):
        if v > Decimal('100000'):
            raise ValueError('Unit price cannot exceed $100,000')
        return v

class OrderCreate(BaseModel):
    """Model for creating order."""
    user_id: str
    items: List[OrderItemCreate] = Field(..., min_items=1, max_items=100)
    shipping_address: str = Field(..., min_length=10, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)
    
    @validator('shipping_address')
    def sanitize_address(cls, v):
        v = bleach.clean(v, tags=[], strip=True)
        if not v.strip():
            raise ValueError('Shipping address cannot be empty')
        return v.strip()
    
    @validator('notes')
    def sanitize_notes(cls, v):
        if v:
            v = bleach.clean(v, tags=['p', 'br'], strip=True)
            return v.strip()
        return v

class OrderResponse(BaseModel):
    """Model for order response."""
    id: int
    user_id: str
    status: str
    total_amount: Decimal
    shipping_address: str
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class OrderWithItems(OrderResponse):
    """Order with items nested."""
    items: List[dict]
```

### 6. Service Layer (MANDATORY)

```python
# services/order_service.py - Business logic layer
from typing import List, Dict, Any
from repositories.order_repository import OrderRepository
from repositories.user_repository import UserRepository
from models.order import OrderCreate, OrderResponse
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

class OrderService:
    """Business logic for orders."""
    
    def __init__(
        self,
        order_repo: OrderRepository,
        user_repo: UserRepository
    ):
        self.order_repo = order_repo
        self.user_repo = user_repo
    
    async def create_order(
        self,
        order_data: OrderCreate,
        current_user_id: str
    ) -> Dict[str, Any]:
        """
        Create order with validation and business logic.
        
        Business rules:
        - User can only create orders for themselves
        - Validate products exist and are in stock
        - Calculate total amount
        - Send confirmation email
        """
        try:
            # Validate user is creating order for themselves
            if order_data.user_id != current_user_id:
                raise HTTPException(
                    status_code=403,
                    detail="Cannot create order for another user"
                )
            
            # Verify user exists
            user = await self.user_repo.get_by_id(current_user_id)
            if not user:
                raise HTTPException(
                    status_code=404,
                    detail="User not found"
                )
            
            # Calculate total amount
            total_amount = sum(
                item.quantity * item.unit_price
                for item in order_data.items
            )
            
            # Create order with items (transactional)
            order = await self.order_repo.create_with_items(
                order_data={
                    "user_id": current_user_id,
                    "total_amount": str(total_amount),
                    "shipping_address": order_data.shipping_address,
                    "notes": order_data.notes,
                    "status": "pending"
                },
                items_data=[
                    {
                        "product_id": item.product_id,
                        "quantity": item.quantity,
                        "unit_price": str(item.unit_price)
                    }
                    for item in order_data.items
                ]
            )
            
            logger.info(f"Order created: {order['id']} for user {current_user_id}")
            
            # TODO: Send confirmation email (async task)
            # await email_service.send_order_confirmation(order)
            
            return order
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create order: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail="Failed to create order"
            )
    
    async def get_user_orders(
        self,
        user_id: str,
        current_user_id: str,
        current_user_role: str,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """Get orders for a user with authorization check."""
        try:
            # Authorization: users can only see their own orders, admins can see all
            if user_id != current_user_id and current_user_role != "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Not authorized to view these orders"
                )
            
            offset = (page - 1) * page_size
            orders, total = await self.order_repo.get_user_orders(
                user_id=user_id,
                status=status,
                limit=page_size,
                offset=offset
            )
            
            return {
                "orders": orders,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to fetch orders: {e}")
            raise HTTPException(
                status_code=500,
                detail="Failed to retrieve orders"
            )
    
    async def update_order_status(
        self,
        order_id: int,
        new_status: str,
        current_user_id: str,
        current_user_role: str
    ) -> Dict[str, Any]:
        """Update order status with authorization."""
        try:
            # Get order
            order = await self.order_repo.get_by_id(str(order_id))
            if not order:
                raise HTTPException(
                    status_code=404,
                    detail="Order not found"
                )
            
            # Authorization: users can cancel their own orders, admins can change any
            if order["user_id"] != current_user_id and current_user_role != "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Not authorized to update this order"
                )
            
            # Business logic: validate status transitions
            valid_transitions = {
                "pending": ["processing", "cancelled"],
                "processing": ["shipped", "cancelled"],
                "shipped": ["delivered"],
                "delivered": [],
                "cancelled": []
            }
            
            current_status = order["status"]
            if new_status not in valid_transitions.get(current_status, []):
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot transition from {current_status} to {new_status}"
                )
            
            # Update order
            updated_order = await self.order_repo.update(
                str(order_id),
                {"status": new_status}
            )
            
            logger.info(f"Order {order_id} status updated to {new_status}")
            
            return updated_order
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to update order status: {e}")
            raise HTTPException(
                status_code=500,
                detail="Failed to update order"
            )
```

### 7. API Routes (MANDATORY)

```python
# routers/orders.py - API endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from dependencies import get_current_user, get_supabase_client, require_admin
from repositories.order_repository import OrderRepository, get_order_repository
from repositories.user_repository import UserRepository, get_user_repository
from services.order_service import OrderService
from models.order import OrderCreate, OrderResponse
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/orders", tags=["Orders"])

@router.post(
    "/",
    response_model=dict,
    status_code=201,
    summary="Create a new order",
    description="""
    Create a new order for the authenticated user.
    
    ## Process Flow
    1. Validates order data and user authentication
    2. Verifies product availability
    3. Creates order in transaction
    4. Sends confirmation email
    5. Returns order details
    
    ## Business Rules
    - User can only create orders for themselves
    - Minimum 1 item, maximum 100 items
    - All products must exist
    
    ## Rate Limiting
    - 10 requests per minute per user
    """,
    responses={
        201: {"description": "Order created successfully"},
        400: {"description": "Invalid order data"},
        403: {"description": "Not authorized"},
        500: {"description": "Server error"}
    }
)
async def create_order(
    order: OrderCreate,
    current_user: dict = Depends(get_current_user),
    order_repo: OrderRepository = Depends(get_order_repository),
    user_repo: UserRepository = Depends(get_user_repository)
):
    """Create new order endpoint."""
    service = OrderService(order_repo, user_repo)
    return await service.create_order(order, current_user["id"])

@router.get(
    "/my-orders",
    response_model=dict,
    summary="Get my orders",
    description="Get all orders for the authenticated user with pagination and filtering"
)
async def get_my_orders(
    status: Optional[str] = Query(None, regex="^(pending|processing|shipped|delivered|cancelled)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    order_repo: OrderRepository = Depends(get_order_repository),
    user_repo: UserRepository = Depends(get_user_repository)
):
    """Get orders for authenticated user."""
    service = OrderService(order_repo, user_repo)
    return await service.get_user_orders(
        user_id=current_user["id"],
        current_user_id=current_user["id"],
        current_user_role=current_user["role"],
        status=status,
        page=page,
        page_size=page_size
    )

@router.get(
    "/{order_id}",
    response_model=dict,
    summary="Get specific order",
    description="Get order details with authorization check"
)
async def get_order(
    order_id: int,
    current_user: dict = Depends(get_current_user),
    order_repo: OrderRepository = Depends(get_order_repository)
):
    """Get specific order with ownership verification."""
    try:
        order = await order_repo.get_by_id(str(order_id))
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Authorization check
        if order["user_id"] != current_user["id"] and current_user["role"] != "admin":
            logger.warning(
                f"User {current_user['id']} attempted to access order {order_id}"
            )
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this order"
            )
        
        return order
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch order: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve order"
        )

@router.patch(
    "/{order_id}/status",
    response_model=dict,
    summary="Update order status",
    description="Update order status with validation"
)
async def update_order_status(
    order_id: int,
    status: str = Query(..., regex="^(processing|shipped|delivered|cancelled)$"),
    current_user: dict = Depends(get_current_user),
    order_repo: OrderRepository = Depends(get_order_repository),
    user_repo: UserRepository = Depends(get_user_repository)
):
    """Update order status."""
    service = OrderService(order_repo, user_repo)
    return await service.update_order_status(
        order_id=order_id,
        new_status=status,
        current_user_id=current_user["id"],
        current_user_role=current_user["role"]
    )

@router.get(
    "/admin/all",
    response_model=dict,
    summary="Get all orders (admin only)",
    dependencies=[Depends(require_admin)]
)
async def get_all_orders_admin(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    order_repo: OrderRepository = Depends(get_order_repository)
):
    """Get all orders - admin only."""
    try:
        offset = (page - 1) * page_size
        orders = await order_repo.get_all(limit=page_size, offset=offset)
        
        return {
            "orders": orders,
            "page": page,
            "page_size": page_size
        }
    except Exception as e:
        logger.error(f"Failed to fetch all orders: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve orders"
        )
```

### 8. Error Handling (MANDATORY)

```python
# main.py - Global error handling
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging
import time
import uuid

logger = logging.getLogger(__name__)

app = FastAPI(
    title="E-Commerce API",
    description="Production-grade API with Supabase",
    version="1.0.0"
)

# Custom exceptions
class DatabaseError(Exception):
    """Database operation failed."""
    pass

class AuthorizationError(Exception):
    """User not authorized."""
    pass

# Global exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors."""
    logger.error(f"Validation error on {request.url}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "validation_error",
            "message": "Invalid request data",
            "details": exc.errors()
        }
    )

@app.exception_handler(DatabaseError)
async def database_error_handler(request: Request, exc: DatabaseError):
    """Handle database errors."""
    logger.error(f"Database error on {request.url}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "database_error",
            "message": "A database error occurred",
            "request_id": request_id,
            "method": request.method,
            "url": str(request.url),
            "client_ip": request.client.host,
        }
    )
    
    try:
        response = await call_next(request)
        
        duration = time.time() - start_time
        
        logger.info(
            "Request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "url": str(request.url),
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2),
            }
        )
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response
        
    except Exception as e:
        logger.error(
            "Request failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "url": str(request.url),
                "error": str(e),
            },
            exc_info=True
        )
        raise

# CORS configuration
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://yourdomain.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 9. Rate Limiting (MANDATORY)

```python
# Install: pip install slowapi
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to routes
@router.post("/orders")
@limiter.limit("10/minute")  # 10 requests per minute
async def create_order(request: Request, order: OrderCreate, ...):
    """Create order with rate limiting."""
    pass

@router.get("/products")
@limiter.limit("100/minute")  # Higher limit for reads
async def get_products(request: Request, ...):
    """Get products with rate limiting."""
    pass
```

### 10. Testing (MANDATORY)

```python
# tests/conftest.py - Test fixtures
import pytest
from fastapi.testclient import TestClient
from main import app
from supabase import create_client, Client

@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)

@pytest.fixture
def supabase_client():
    """Supabase test client."""
    return create_client(
        "http://localhost:54321",  # Local Supabase
        "test-service-key"
    )

@pytest.fixture
def auth_headers(supabase_client):
    """Create authenticated user and return auth headers."""
    # Sign up test user
    user = supabase_client.auth.sign_up({
        "email": "test@example.com",
        "password": "testpassword123"
    })
    
    token = user.session.access_token
    
    yield {"Authorization": f"Bearer {token}"}
    
    # Cleanup
    supabase_client.auth.admin.delete_user(user.user.id)

# tests/test_orders.py - Order endpoint tests
import pytest

class TestOrderCreation:
    """Test order creation with edge cases."""
    
    def test_create_order_success(self, client, auth_headers):
        """Test successful order creation."""
        order_data = {
            "user_id": "user-id",
            "items": [
                {
                    "product_id": 1,
                    "quantity": 2,
                    "unit_price": "10.99"
                }
            ],
            "shipping_address": "123 Test Street, Test City"
        }
        
        response = client.post(
            "/api/v1/orders",
            json=order_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["status"] == "pending"
    
    def test_create_order_empty_items(self, client, auth_headers):
        """Edge case: Empty items list."""
        order_data = {
            "user_id": "user-id",
            "items": [],  # Empty!
            "shipping_address": "123 Test Street"
        }
        
        response = client.post(
            "/api/v1/orders",
            json=order_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        assert "items" in response.json()["details"][0]["loc"]
    
    def test_create_order_negative_quantity(self, client, auth_headers):
        """Edge case: Negative quantity."""
        order_data = {
            "user_id": "user-id",
            "items": [
                {
                    "product_id": 1,
                    "quantity": -5,  # Negative!
                    "unit_price": "10.99"
                }
            ],
            "shipping_address": "123 Test Street"
        }
        
        response = client.post(
            "/api/v1/orders",
            json=order_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
    
    def test_create_order_unauthorized(self, client):
        """Edge case: No authentication token."""
        order_data = {
            "user_id": "user-id",
            "items": [
                {
                    "product_id": 1,
                    "quantity": 2,
                    "unit_price": "10.99"
                }
            ],
            "shipping_address": "123 Test Street"
        }
        
        response = client.post("/api/v1/orders", json=order_data)
        assert response.status_code == 401
    
    def test_create_order_wrong_user(self, client, auth_headers):
        """Edge case: Creating order for another user."""
        order_data = {
            "user_id": "different-user-id",  # Different user!
            "items": [
                {
                    "product_id": 1,
                    "quantity": 2,
                    "unit_price": "10.99"
                }
            ],
            "shipping_address": "123 Test Street"
        }
        
        response = client.post(
            "/api/v1/orders",
            json=order_data,
            headers=auth_headers
        )
        
        assert response.status_code == 403
    
    def test_create_order_xss_attempt(self, client, auth_headers):
        """Security test: XSS in notes field."""
        order_data = {
            "user_id": "user-id",
            "items": [
                {
                    "product_id": 1,
                    "quantity": 2,
                    "unit_price": "10.99"
                }
            ],
            "shipping_address": "123 Test Street",
            "notes": "<script>alert('xss')</script>"
        }
        
        response = client.post(
            "/api/v1/orders",
            json=order_data,
            headers=auth_headers
        )
        
        # Should succeed with sanitized input
        assert response.status_code == 201
        data = response.json()
        # Script tags should be removed
        assert "<script>" not in data.get("notes", "")
```

### 11. Health Checks (MANDATORY)

```python
# routers/health.py - Health check endpoints
from fastapi import APIRouter, Depends, status
from dependencies import get_supabase_client
from supabase import Client
from datetime import datetime

router = APIRouter(tags=["Health"])

@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """
    Basic health check endpoint.
    
    Returns OK if service is running.
    Used by load balancers and orchestrators.
    """
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/health/detailed", status_code=status.HTTP_200_OK)
async def detailed_health_check(
    supabase: Client = Depends(get_supabase_client)
):
    """
    Detailed health check with dependency status.
    
    Checks:
    - Supabase connectivity
    - Database query execution
    """
    checks = {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "checks": {}
    }
    
    # Check Supabase connection
    try:
        result = supabase.table("users").select("id").limit(1).execute()
        checks["checks"]["supabase"] = {
            "status": "ok",
            "response_time_ms": 0  # Add timing if needed
        }
    except Exception as e:
        checks["status"] = "degraded"
        checks["checks"]["supabase"] = {
            "status": "error",
            "error": str(e)
        }
    
    return checks
```

### 12. File Upload (Supabase Storage)

```python
# routers/uploads.py - File upload endpoints
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from dependencies import get_current_user, get_supabase_client
from supabase import Client
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/uploads", tags=["Uploads"])

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def validate_file(file: UploadFile) -> None:
    """Validate uploaded file."""
    # Check file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only images are allowed"
        )
    
    # Check file extension
    if file.filename:
        ext = file.filename.split(".")[-1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file extension. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """
    Upload user avatar to Supabase Storage.
    
    ✅ Uses Supabase Storage with proper access control.
    """
    try:
        # Validate file
        validate_file(file)
        
        # Check file size
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024}MB"
            )
        
        # Generate file path
        file_ext = file.filename.split(".")[-1] if file.filename else "jpg"
        file_path = f"{current_user['id']}.{file_ext}"
        
        # Upload to Supabase Storage
        result = supabase.storage.from_("avatars").upload(
            path=file_path,
            file=file_content,
            file_options={
                "content-type": file.content_type,
                "upsert": "true"
            }
        )
        
        # Get public URL
        public_url = supabase.storage.from_("avatars").get_public_url(file_path)
        
        # Update user profile with avatar URL
        supabase.table("users")\
            .update({"avatar_url": public_url})\
            .eq("id", current_user["id"])\
            .execute()
        
        logger.info(f"Avatar uploaded for user {current_user['id']}")
        
        return {
            "avatar_url": public_url,
            "message": "Avatar uploaded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload avatar: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to upload file"
        )

@router.delete("/avatar")
async def delete_avatar(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Delete user avatar."""
    try:
        # Get user to find avatar path
        user = supabase.table("users")\
            .select("avatar_url")\
            .eq("id", current_user["id"])\
            .single()\
            .execute()
        
        if user.data and user.data.get("avatar_url"):
            # Extract file path from URL
            file_path = user.data["avatar_url"].split("/")[-1]
            
            # Delete from storage
            supabase.storage.from_("avatars").remove([file_path])
        
        # Clear avatar URL from profile
        supabase.table("users")\
            .update({"avatar_url": None})\
            .eq("id", current_user["id"])\
            .execute()
        
        logger.info(f"Avatar deleted for user {current_user['id']}")
        
        return {"message": "Avatar deleted successfully"}
        
    except Exception as e:
        logger.error(f"Failed to delete avatar: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete file"
        )
```

---

# 🗄️ SUPABASE DATABASE RULES (Both Frontend & Backend)

## Required SQL Setup

```sql
-- 1. CREATE TABLES WITH PROPER STRUCTURE
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'moderator')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL CHECK (price > 0),
  category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  shipping_address TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ENABLE ROW LEVEL SECURITY (MANDATORY!)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 3. CREATE RLS POLICIES
-- Users: Can view and update own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Products: Anyone can view active products
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  USING (is_active = true);

-- Products: Admins can do anything
CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Orders: Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

-- Orders: Users can create their own orders
CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Orders: Users can update their own pending orders
CREATE POLICY "Users can cancel own orders"
  ON orders FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (status = 'cancelled');

-- Orders: Admins can view/update all orders
CREATE POLICY "Admins can manage all orders"
  ON orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Order Items: Users can view items from their orders
CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- 4. CREATE INDEXES (MANDATORY FOR PERFORMANCE!)
-- Index foreign keys
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Index commonly filtered columns
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_active ON products(is_active);

-- Composite indexes for common queries
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC);

-- Partial indexes for filtered queries
CREATE INDEX idx_active_products ON products(id, name, price) WHERE is_active = true;
CREATE INDEX idx_pending_orders ON orders(id, created_at) WHERE status = 'pending';

-- 5. CREATE TRIGGERS FOR AUTO-UPDATE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. CREATE RPC FUNCTIONS FOR TRANSACTIONS
CREATE OR REPLACE FUNCTION create_order_with_items(
  order_data JSONB,
  items_data JSONB
)
RETURNS JSONB AS $
DECLARE
  new_order_id BIGINT;
  result JSONB;
BEGIN
  -- Insert order
  INSERT INTO orders (user_id, status, total_amount, shipping_address, notes)
  VALUES (
    (order_data->>'user_id')::UUID,
    COALESCE(order_data->>'status', 'pending'),
    (order_data->>'total_amount')::DECIMAL,
    order_data->>'shipping_address',
    order_data->>'notes'
  )
  RETURNING id INTO new_order_id;
  
  -- Insert order items
  INSERT INTO order_items (order_id, product_id, quantity, unit_price)
  SELECT
    new_order_id,
    (item->>'product_id')::BIGINT,
    (item->>'quantity')::INTEGER,
    (item->>'unit_price')::DECIMAL
  FROM jsonb_array_elements(items_data) AS item;
  
  -- Return complete order with items
  SELECT jsonb_build_object(
    'id', o.id,
    'user_id', o.user_id,
    'status', o.status,
    'total_amount', o.total_amount,
    'shipping_address', o.shipping_address,
    'notes', o.notes,
    'created_at', o.created_at,
    'items', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price
        )
      )
      FROM order_items oi
      WHERE oi.order_id = o.id
    )
  )
  INTO result
  FROM orders o
  WHERE o.id = new_order_id;
  
  RETURN result;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. CREATE AGGREGATION FUNCTIONS
CREATE OR REPLACE FUNCTION get_user_orders_summary(uid UUID)
RETURNS TABLE (
  total_orders BIGINT,
  total_spent DECIMAL,
  pending_orders BIGINT,
  completed_orders BIGINT,
  avg_order_value DECIMAL
) AS $
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_orders,
    COALESCE(SUM(total_amount), 0) as total_spent,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_orders,
    COUNT(*) FILTER (WHERE status = 'delivered')::BIGINT as completed_orders,
    COALESCE(AVG(total_amount), 0) as avg_order_value
  FROM orders
  WHERE user_id = uid;
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 8. CONFIGURE SUPABASE STORAGE
-- Run in Supabase Dashboard: Storage > Create Bucket
-- Bucket name: avatars
-- Public: true
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- Storage RLS policies
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

# 🚨 RED FLAGS - NEVER ALLOW

## Frontend Red Flags
- ❌ Using `any` type in TypeScript
- ❌ Direct Supabase calls in components (no service layer)
- ❌ Using service role key on frontend
- ❌ No error boundaries
- ❌ Missing input validation/sanitization
- ❌ No loading states
- ❌ Fetching all data without pagination
- ❌ No TypeScript types for API responses
- ❌ Client Components when Server Components would work
- ❌ Missing authentication checks on protected routes

## Backend Red Flags
- ❌ Using anon key instead of service role key
- ❌ Direct Supabase calls in routes (no repository pattern)
- ❌ No service layer (business logic in routes)
- ❌ Missing input validation (Pydantic models)
- ❌ No error handling on I/O operations
- ❌ SQL queries in loops (N+1 problem)
- ❌ Synchronous code for I/O operations
- ❌ No rate limiting on public endpoints
- ❌ Missing authorization checks
- ❌ Exposing internal errors to clients
- ❌ No logging for critical operations
- ❌ Hard coded secrets or config

## Database Red Flags
- ❌ Tables without RLS enabled
- ❌ Missing RLS policies
- ❌ Foreign keys without indexes
- ❌ No indexes on filtered/sorted columns
- ❌ Using `SELECT *` in production
- ❌ No pagination on large datasets
- ❌ Missing database functions for transactions
- ❌ Not using foreign key expansion (N+1 queries)
- ❌ Storing files in database instead of Storage

---

# 💡 GOLDEN RULES SUMMARY

## Frontend
1. **Server Components First** - Only use Client Components for interactivity
2. **Service Layer Always** - Never call Supabase directly in components
3. **Type Everything** - Generate and use Supabase types
4. **Validate Input** - Sanitize all user input
5. **Error Boundaries** - Graceful error handling everywhere
6. **Anon Key Only** - Never use service role key on frontend

## Backend
7. **Repository Pattern** - All database access through repositories
8. **Service Layer** - Business logic separate from routes
9. **Service Role Key** - Never use anon key on backend
10. **Validate Everything** - Pydantic models for all input
11. **Async Everything** - All I/O must be async
12. **RLS + Backend Auth** - Defense in depth

## Database
13. **RLS Always** - Every table must have RLS enabled
14. **Index Foreign Keys** - All foreign keys must be indexed
15. **Use RPC Functions** - For transactions and complex operations
16. **Foreign Key Expansion** - Avoid N+1 queries
17. **Pagination Required** - Never fetch all records
18. **Use Storage** - For files, not database

---

**Remember**: Production code won't wake you up at 3 AM. Design for resilience, security, and maintainability from day one!id": request.state.request_id
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions."""
    logger.error(
        f"Unhandled exception on {request.url}: {exc}",
        exc_info=True
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred",
            "request_id": request.state.request_id
        }
    )

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with timing and request ID."""
    start_time = time.time()
    
    # Generate request ID
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    logger.info(
        f"Request started",
        extra={
            "request_
        