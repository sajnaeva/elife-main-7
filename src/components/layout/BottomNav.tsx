import { Link, useLocation } from 'react-router-dom';
import { PlusSquare, Users, User, UserCheck } from 'lucide-react';
import logoImg from '@/assets/logo.jpg';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: null, label: 'Home', path: '/', isLogo: true },
  { icon: UserCheck, label: 'Friends', path: '/friends' },
  { icon: PlusSquare, label: 'Create', path: '/create' },
  { icon: Users, label: 'Community', path: '/communities' },
  { icon: User, label: 'Profile', path: '/profile' },
];

export function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-effect border-t">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ icon: Icon, label, path, isLogo }) => {
          const isActive = location.pathname === path;
          const requiresAuth = ['/create', '/profile'].includes(path);
          const actualPath = requiresAuth && !user ? '/auth' : path;
          
          return (
            <Link
              key={path}
              to={actualPath}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isLogo ? (
                <img 
                  src={logoImg} 
                  alt="Home" 
                  className={cn(
                    'h-6 w-6 rounded-md object-cover transition-all duration-300 hover:scale-125 hover:rotate-6',
                    isActive && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                  )}
                />
              ) : Icon ? (
                <Icon className={cn('h-6 w-6', isActive && 'stroke-[2.5px]')} />
              ) : null}
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
