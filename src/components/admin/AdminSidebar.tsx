import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  FileText, 
  Users2, 
  Flag, 
  Tags, 
  Star,
  MessageCircle,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldAlert,
  Megaphone
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface SidebarLink {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRole?: 'super_admin' | 'content_moderator' | 'category_manager';
}

const sidebarLinks: SidebarLink[] = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { title: 'Users', href: '/admin/users', icon: Users },
  { title: 'Businesses', href: '/admin/businesses', icon: Building2 },
  { title: 'Posts', href: '/admin/posts', icon: FileText, requiredRole: 'content_moderator' },
  { title: 'Promotions', href: '/admin/promotions', icon: Megaphone },
  { title: 'Communities', href: '/admin/communities', icon: Users2 },
  { title: 'Reports', href: '/admin/reports', icon: Flag, requiredRole: 'content_moderator' },
  { title: 'Word Monitor', href: '/admin/blocked-words', icon: ShieldAlert, requiredRole: 'content_moderator' },
  { title: 'Categories', href: '/admin/categories', icon: Tags, requiredRole: 'category_manager' },
  { title: 'Featured', href: '/admin/featured', icon: Star },
  { title: 'Chat Moderation', href: '/admin/chat', icon: MessageCircle, requiredRole: 'content_moderator' },
  { title: 'Notifications', href: '/admin/notifications', icon: Bell, requiredRole: 'super_admin' },
  { title: 'Settings', href: '/admin/settings', icon: Settings, requiredRole: 'super_admin' },
];

export function AdminSidebar() {
  const { isSuperAdmin, isContentModerator, isCategoryManager, roles } = useAdminAuth();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const canAccessLink = (link: SidebarLink) => {
    if (!link.requiredRole) return true;
    if (isSuperAdmin) return true;
    if (link.requiredRole === 'content_moderator' && isContentModerator) return true;
    if (link.requiredRole === 'category_manager' && isCategoryManager) return true;
    return false;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const filteredLinks = sidebarLinks.filter(canAccessLink);

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <span className="text-white font-bold text-sm">സം</span>
              </div>
              <span className="font-semibold text-sidebar-foreground">Admin Panel</span>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {filteredLinks.map((link) => (
              <li key={link.href}>
                <NavLink
                  to={link.href}
                  end={link.href === '/admin'}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActive 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                        : "text-sidebar-foreground",
                      collapsed && "justify-center px-2"
                    )
                  }
                  title={collapsed ? link.title : undefined}
                >
                  <link.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{link.title}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User section */}
        <div className="border-t border-sidebar-border p-4">
          <div className={cn(
            "flex items-center gap-3",
            collapsed && "justify-center"
          )}>
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {profile?.full_name?.charAt(0) || 'A'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile?.full_name || 'Admin'}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {roles[0]?.replace('_', ' ') || 'Admin'}
                </p>
              </div>
            )}
            {!collapsed && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSignOut}
                className="h-8 w-8 shrink-0"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
