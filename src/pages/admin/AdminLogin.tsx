import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from '@/assets/logo.jpg';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, Lock, Shield, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const validate = () => {
    const newErrors: Record<string, string> = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);

    try {
      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: 'Login failed',
          description: error.message,
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      if (!data.user) {
        toast({
          title: 'Login failed',
          description: 'No user found',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Check if user has admin role
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id);

      if (rolesError || !roles || roles.length === 0) {
        // Sign out the user if they don't have admin access
        await supabase.auth.signOut();
        toast({
          title: 'Access denied',
          description: 'You do not have admin privileges',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      toast({
        title: 'Welcome back!',
        description: 'Successfully logged in to admin panel',
      });

      navigate('/admin');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back button */}
        <Button variant="ghost" className="mb-6" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to home
        </Button>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative mx-auto w-fit">
            <img 
              src={logoImg} 
              alt="സംരംഭക.com Logo" 
              className="h-20 w-auto rounded-2xl shadow-glow transition-all duration-300 hover:scale-110 hover:rotate-3 cursor-pointer"
            />
            <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-lg">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mt-4">Admin Panel</h1>
          <p className="text-muted-foreground mt-2">സംരംഭക.com Administration</p>
        </div>

        <Card className="shadow-xl border-0 bg-card/95 backdrop-blur">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">Admin Login</CardTitle>
            <CardDescription className="text-center">
              Enter your admin credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email"
                    placeholder="admin@example.com" 
                    className="pl-10" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    autoComplete="email"
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Enter your password" 
                    className="pl-10 pr-10" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    autoComplete="current-password"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" 
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 font-semibold" 
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In to Admin Panel'}
              </Button>
            </form>

            <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground text-center">
                <Shield className="inline h-3 w-3 mr-1" />
                This area is restricted to authorized administrators only.
                All login attempts are logged.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
